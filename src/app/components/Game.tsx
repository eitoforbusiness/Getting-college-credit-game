'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import BluetoothController, { ControllerData } from './BluetoothController';

const SPECIAL_COURSES = [
  { id: 'statistics', label: '統計入門' },
  { id: 'info_exercise', label: '社会情報体験演習' },
  { id: 'social_science', label: '社会科学概論' },
] as const;

type SpecialCourseId = (typeof SPECIAL_COURSES)[number]['id'];

type Target = {
  id: number;
  x: number;
  y: number;
  kind: 'credit' | 'course';
  label: string;
  courseId?: SpecialCourseId;
};

const STAGE_CONFIG = [
  { id: 1, label: '1ステージ', targetScore: 30, spawnIntervalMs: 500, fallSpeed: 2 },
  { id: 2, label: '2ステージ', targetScore: 70, spawnIntervalMs: 1000, fallSpeed: 2 },
  { id: 3, label: '3ステージ', targetScore: 120, spawnIntervalMs: 1000, fallSpeed: 2 },
  { id: 4, label: '4ステージ', targetScore: 180, spawnIntervalMs: 1000, fallSpeed: 2 },
] as const;

const MAX_SCORE = 124;
const CREDITS_PER_STAGE = 18; // 1年間（1ステージ）で落ちる単位の上限（特別科目と通常単位の合計）

export default function Game() {
  const [controllerData, setControllerData] = useState<ControllerData | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 50, y: 80 });
  const [score, setScore] = useState(0);
  const [collectedUnitsThisStage, setCollectedUnitsThisStage] = useState(0); // 各ステージで取得した単位・特別授業の数
  const [droppedUnitsThisStage, setDroppedUnitsThisStage] = useState(0); // 各ステージで画面下まで落ちた単位・特別授業の数
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isGraduated, setIsGraduated] = useState(false); // 卒業フラグ
  const [stage, setStage] = useState(1);
  const [targets, setTargets] = useState<Target[]>([]);
  const [spawnedTargetsThisStage, setSpawnedTargetsThisStage] = useState(0);
  const [showStageTransition, setShowStageTransition] = useState(false); // ステージ遷移時の表示フラグ
  const targetIdRef = useRef(0);
  const scoredTargetIdsRef = useRef<Set<number>>(new Set());
  // 「同時に2つ落ちない」制御用（画面上に存在するターゲット数）
  const activeTargetsCountRef = useRef(0);
  const playerPositionRef = useRef({ x: 50, y: 80 });
  // これまでに取得済みの特別科目（ゲーム中は二度と出現しない）
  const obtainedCoursesRef = useRef<Set<SpecialCourseId>>(new Set());
  // 各ステージで既に出現させた特別科目（同じ学年では1回だけ出現）
  const spawnedCoursesThisStageRef = useRef<Set<SpecialCourseId>>(new Set());
  // 各ステージで取得した単位・特別授業数を参照するためのref
  const collectedUnitsThisStageRef = useRef(0);
  // 各ステージで画面下まで落ちた単位・特別授業数を参照するためのref
  const droppedUnitsThisStageRef = useRef(0);

  const currentStage = STAGE_CONFIG[stage - 1];
  
  // 学年名のマッピング
  const getGradeName = (stageId: number): string => {
    const gradeMap: Record<number, string> = {
      1: '大学1年生',
      2: '大学2年生',
      3: '大学3年生',
      4: '大学4年生',
    };
    return gradeMap[stageId] || `ステージ${stageId}`;
  };

  const clampToField = (value: number) => Math.max(5, Math.min(95, value));

  const updatePlayerPosition = (next: { x: number; y: number }) => {
    playerPositionRef.current = next;
    return next;
  };

  // 加速度からロール（左右の傾き）を算出し、デッドゾーン＋感度で移動量に変換
  const tiltToDelta = (data: ControllerData) => {
    // ロール: 左右の傾きのみを使用
    const rollRad = Math.atan2(data.accelY, data.accelZ);
    const rollDeg = (rollRad * 180) / Math.PI;

    const deadZoneDeg = 3; // 小さな揺れを無視
    const maxTiltDeg = 35; // これ以上は最大移動量でクリップ
    const movePerFrame = 2.2; // 最大傾き時の1フレーム移動量（%）

    const applyCurve = (deg: number) => {
      if (Math.abs(deg) < deadZoneDeg) return 0;
      const limited = Math.max(-maxTiltDeg, Math.min(maxTiltDeg, deg));
      return (limited / maxTiltDeg) * movePerFrame;
    };

    return {
      deltaX: applyCurve(rollDeg),
      deltaY: 0, // 上下の移動は無効化
    };
  };

  const handleDataReceived = useCallback((data: ControllerData) => {
    setControllerData(data);

    const { deltaX } = tiltToDelta(data);
    // テストモード／ゲーム中どちらでも傾きで移動（左右のみ）
    setPlayerPosition(prev =>
      updatePlayerPosition({
        x: clampToField(prev.x + deltaX),
        y: prev.y, // Y座標は固定（上下移動なし）
      }),
    );
  }, []);

  // ゲームオーバー処理（大学4年生になるまでに必要スコアに届かなかった場合など）
  const triggerGameOver = useCallback(() => {
    setGameStarted(false);
    setGameOver(true);
    setShowStageTransition(false);
    setTargets([]);
    activeTargetsCountRef.current = 0;
  }, []);

  // targetsが変わるたびにrefを更新（落下中の同時出現を防ぐため）
  useEffect(() => {
    activeTargetsCountRef.current = targets.length;
  }, [targets]);

  // 取得数が変わるたびにrefを更新
  useEffect(() => {
    collectedUnitsThisStageRef.current = collectedUnitsThisStage;
  }, [collectedUnitsThisStage]);

  // 落下数が変わるたびにrefを更新
  useEffect(() => {
    droppedUnitsThisStageRef.current = droppedUnitsThisStage;
  }, [droppedUnitsThisStage]);

  // 「この学年で落ちてきた累計」を、生成回数ではなく
  // (取得 + 取り逃し + 画面上) から一意に決まる値として更新する
  useEffect(() => {
    if (!gameStarted) return;
    setSpawnedTargetsThisStage(
      collectedUnitsThisStage + droppedUnitsThisStage + targets.length,
    );
  }, [gameStarted, collectedUnitsThisStage, droppedUnitsThisStage, targets.length]);

  // 12個（CREDITS_PER_STAGE）の単位・授業が落ちたら自動的に次のステージへ進む
  useEffect(() => {
    if (!gameStarted) return;
    
    const totalThisStage = collectedUnitsThisStage + droppedUnitsThisStage + targets.length;
    
    // 4年生で全単位が落ちた時の処理
    if (totalThisStage >= CREDITS_PER_STAGE && stage === 4) {
      if (score < 124) {
        // スコアが124未満ならゲームオーバー
        triggerGameOver();
      } else {
        // スコアが124以上なら卒業
        setGameStarted(false);
        setIsGraduated(true);
        setTargets([]);
        activeTargetsCountRef.current = 0;
      }
      return;
    }
    
    if (totalThisStage >= CREDITS_PER_STAGE && stage < STAGE_CONFIG.length) {
      // 大学4年生になる前（=3年生の終了時点）にスコアが90未満ならゲームオーバー
      if (stage === 3 && score < 90) {
        triggerGameOver();
        return;
      }

      // ステージ遷移の表示を出す
      setShowStageTransition(true);
      
      // 2秒後に次のステージへ進む
      const timer = setTimeout(() => {
        setStage(prev => prev + 1);
        setTargets([]);
        activeTargetsCountRef.current = 0;
        setPlayerPosition(updatePlayerPosition({ x: 50, y: 80 }));
        // 新しい学年に進んだら、その学年での出現履歴をリセット
        spawnedCoursesThisStageRef.current = new Set();
        setSpawnedTargetsThisStage(0);
        setCollectedUnitsThisStage(0);
        collectedUnitsThisStageRef.current = 0;
        setDroppedUnitsThisStage(0);
        droppedUnitsThisStageRef.current = 0;
        setShowStageTransition(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [gameStarted, collectedUnitsThisStage, droppedUnitsThisStage, targets.length, stage, score, triggerGameOver]);

  // ターゲット生成
  useEffect(() => {
    if (!gameStarted) return;

    const intervalMs = currentStage.spawnIntervalMs;

    const interval = setInterval(() => {
      // その学年で「落ちてきた総数」（取得 + 取り逃し + 画面上）を上限で制限
      const totalThisStageBase =
        collectedUnitsThisStageRef.current +
        droppedUnitsThisStageRef.current +
        activeTargetsCountRef.current;
      if (totalThisStageBase >= CREDITS_PER_STAGE) return;

      // 生成は setTargets の updater 内で原子的にガードして、絶対に同時に2つにならないようにする
      setTargets(prev => {
        // すでに1つ落下中なら生成しない（1個ずつ落ちるようにする）
        if (prev.length > 0) return prev;

        // updater 内でも上限制限を再チェック（競合やタイミングずれ対策）
        const totalInUpdater =
          collectedUnitsThisStageRef.current +
          droppedUnitsThisStageRef.current +
          prev.length;
        if (totalInUpdater >= CREDITS_PER_STAGE) return prev;

        // まだ取得しておらず、かつ今のステージでまだ出現させていない特別科目の候補
        const availableSpecialCourses = SPECIAL_COURSES.filter(
          c =>
            !obtainedCoursesRef.current.has(c.id) &&
            !spawnedCoursesThisStageRef.current.has(c.id),
        );

        let newTarget: Target;

        // 特別科目が候補にあり、一定確率で特別科目を落とす
        if (availableSpecialCourses.length > 0 && Math.random() < 0.3) {
          const course =
            availableSpecialCourses[
              Math.floor(Math.random() * availableSpecialCourses.length)
            ];
          spawnedCoursesThisStageRef.current.add(course.id);

          newTarget = {
            id: targetIdRef.current++,
            x: Math.random() * 80 + 10,
            y: 5, // 画面上部から出現
            kind: 'course',
            label: course.label,
            courseId: course.id,
          };
        } else {
          // 通常の単位（無制限に出現）
          newTarget = {
            id: targetIdRef.current++,
            x: Math.random() * 80 + 10,
            y: 5, // 画面上部から出現
            kind: 'credit',
            label: '単位',
          };
        }

        activeTargetsCountRef.current = 1;
        return [...prev, newTarget];
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [gameStarted, currentStage.spawnIntervalMs]);

  // ターゲットを下方向に落としつつ、プレイヤーとの衝突判定を行う
  useEffect(() => {
    if (!gameStarted) return;

    const fallSpeed = currentStage.fallSpeed; // 1ティックごとに落ちる量（%）
    const intervalMs = 80;

    const interval = setInterval(() => {
      setTargets(prevTargets => {
        const remaining: Target[] = [];
        let hitCount = 0;
        let droppedCount = 0;
        const obtainedCourseIds: SpecialCourseId[] = [];

        prevTargets.forEach(target => {
          const moved = { ...target, y: target.y + fallSpeed };

          // プレイヤーとの衝突判定（少しでも重なったらヒット）
          const dx = moved.x - playerPositionRef.current.x;
          const dy = moved.y - playerPositionRef.current.y;
          const distance = Math.hypot(dx, dy);
          const hitRadius = 7; // 当たり判定の広さ

          if (distance < hitRadius) {
            // まだスコア加算していないターゲットだけ加算
            if (!scoredTargetIdsRef.current.has(moved.id)) {
              scoredTargetIdsRef.current.add(moved.id);
              hitCount += 1;
              // 特別科目を取得したら、それ以降はどの学年にも落ちてこないようにする
              if (moved.kind === 'course' && moved.courseId) {
                obtainedCourseIds.push(moved.courseId);
              }
            }
            return; // このターゲットは削除
          }

          // 画面下（100%）まで到達したターゲットは削除（落下としてカウント）
          if (moved.y > 100) {
            droppedCount += 1;
            return;
          }

          remaining.push(moved);
        });

        // 1フレーム内で複数同時に取得/落下しても、必ず個数分まとめて加算する
        if (hitCount > 0) {
          setScore(s => s + hitCount * 4); // 1つの単位・授業ごとに4点
          setCollectedUnitsThisStage(c => c + hitCount);
        }

        if (obtainedCourseIds.length > 0) {
          obtainedCourseIds.forEach(id => obtainedCoursesRef.current.add(id));
        }

        if (droppedCount > 0) {
          setDroppedUnitsThisStage(d => d + droppedCount);
        }

        // 次フレーム用にrefも即時更新
        activeTargetsCountRef.current = remaining.length;
        return remaining;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [gameStarted, currentStage.fallSpeed]);

  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setCollectedUnitsThisStage(0);
    setDroppedUnitsThisStage(0);
    setStage(1);
    setShowStageTransition(false);
    setGameOver(false);
    setIsGraduated(false);
    setPlayerPosition(updatePlayerPosition({ x: 50, y: 80 }));
    setTargets([]);
    activeTargetsCountRef.current = 0;
    setSpawnedTargetsThisStage(0);
    targetIdRef.current = 0;
    scoredTargetIdsRef.current = new Set();
    obtainedCoursesRef.current = new Set();
    spawnedCoursesThisStageRef.current = new Set();
    collectedUnitsThisStageRef.current = 0;
    droppedUnitsThisStageRef.current = 0;
  };

  const stopGame = () => {
    setGameStarted(false);
    setTargets([]);
    activeTargetsCountRef.current = 0;
    setPlayerPosition(updatePlayerPosition({ x: 50, y: 80 }));
  };

  return (
    <div className="flex flex-col items-center gap-8 p-4 md:p-8 w-full max-w-3xl md:max-w-5xl lg:max-w-6xl xl:max-w-[1400px] 2xl:max-w-[1600px]">
      <BluetoothController onDataReceived={handleDataReceived} />
      
      <div className="w-full">
        <div className="mb-4 text-center space-y-3">
          <div className="flex flex-col items-center gap-1">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              スコア: {score}
            </h2>
            {/* スコアゲージ */}
            <div className="w-full max-w-md mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">0</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {score} / {MAX_SCORE}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{MAX_SCORE}</span>
              </div>
              <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 ease-out rounded-full"
                  style={{
                    width: `${Math.min((score / MAX_SCORE) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 flex flex-col items-center gap-1">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-100 text-sm font-semibold">
                現在の学年: {getGradeName(stage)}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                この学年で落ちてきた単位・特別授業（累計）: {spawnedTargetsThisStage} / {CREDITS_PER_STAGE}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                いま画面上に落ちている単位・特別授業: {targets.length}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                この学年で取得した単位・特別授業: {collectedUnitsThisStage}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                この学年で取り逃した単位・特別授業: {droppedUnitsThisStage}
              </span>
              {stage < STAGE_CONFIG.length ? (
                <span>
                  {CREDITS_PER_STAGE}個の単位・授業が落ちたら次の学年へ進みます
                </span>
              ) : (
                <span>最終学年です</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 justify-center mt-2">
            {!gameStarted ? (
              <button
                onClick={startGame}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-lg"
              >
                ゲーム開始
              </button>
            ) : (
              <button
                onClick={stopGame}
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-lg"
              >
                ゲーム停止
              </button>
            )}

          </div>
        </div>
        
        {/* ゲーム画面 */}
        <div className="relative w-full h-[34rem] md:h-[42rem] lg:h-[46rem] bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl overflow-hidden border-2 border-gray-300 dark:border-gray-700 shadow-2xl">
          {/* プレイヤー */}
          <div
            className="absolute w-8 h-8 bg-blue-500 rounded-full transition-all duration-100 shadow-lg border-2 border-white"
            style={{
              left: `${playerPosition.x}%`,
              top: `${playerPosition.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
          
          {/* ターゲット（単位カード） */}
          {targets.map(target => (
            <div
              key={target.id}
              className="absolute w-12 h-8 bg-white/90 dark:bg-yellow-100/90 rounded-md shadow-lg border border-yellow-400 flex items-center justify-center text-xs font-bold text-yellow-700 dark:text-yellow-800 rotate-3"
              style={{
                left: `${target.x}%`,
                top: `${target.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {target.label}
            </div>
          ))}

          {/* ステージ遷移時の表示 */}
          {showStageTransition && !gameOver && !isGraduated && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 rounded-lg z-50">
              <div className="text-center text-white">
                <h2 className="text-6xl md:text-8xl font-bold mb-4 animate-pulse">
                  {getGradeName(stage + 1)}
                </h2>
                <p className="text-xl md:text-2xl text-gray-300 mt-4">
                  進級しました！
                </p>
              </div>
            </div>
          )}

          {/* ゲームオーバー表示 */}
          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 rounded-lg z-50">
              <div className="text-center text-white px-6">
                <h2 className="text-5xl md:text-7xl font-extrabold mb-6 text-red-400 drop-shadow-lg">
                  ゲームオーバー
                </h2>
                <p className="text-lg md:text-2xl text-gray-200 mb-4">
                  {stage === 4
                    ? 'スコアが124に届きませんでした。'
                    : '大学4年生になるまでにスコア90に届きませんでした。'}
                </p>
                <p className="text-sm md:text-base text-gray-300 mb-6">
                  もう一度チャレンジして、単位をしっかり集めよう！
                </p>
                <button
                  type="button"
                  onClick={startGame}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg shadow-lg transition-colors"
                >
                  もう一度プレイ
                </button>
              </div>
            </div>
          )}

          {/* 卒業表示 */}
          {isGraduated && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 rounded-lg z-50">
              <div className="text-center text-white px-6">
                <h2 className="text-5xl md:text-7xl font-extrabold mb-6 text-yellow-400 drop-shadow-lg animate-pulse">
                  卒業
                </h2>
                <p className="text-lg md:text-2xl text-gray-200 mb-4">
                  おめでとうございます！
                </p>
                <p className="text-sm md:text-base text-gray-300 mb-2">
                  最終スコア: {score} / {MAX_SCORE}
                </p>
                <p className="text-sm md:text-base text-gray-300 mb-6">
                  無事に大学を卒業できました！
                </p>
                <button
                  type="button"
                  onClick={startGame}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg shadow-lg transition-colors"
                >
                  もう一度プレイ
                </button>
              </div>
            </div>
          )}

          {/* ゲーム説明 / 操作確認モード */}
          {!gameStarted && !gameOver && !isGraduated && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
              <div className="text-center text-white p-6 bg-gray-800 bg-opacity-90 rounded-lg max-w-md">
                {controllerData ? (
                  <>
                    <h3 className="text-2xl font-bold mb-4 text-green-400">✓ 操作確認モード</h3>
                    <p className="mb-4 text-sm">M5StickCplus2が接続されました。以下の操作を試してください：</p>
                    <ul className="text-left space-y-2 text-sm mb-4">
                      <li className={controllerData.buttonA ? 'text-green-400 font-bold' : ''}>
                        • ボタンAを押す → {controllerData.buttonA ? '✓ 検出中' : '未検出'}
                      </li>
                      <li className={controllerData.buttonB ? 'text-green-400 font-bold' : ''}>
                        • ボタンBを押す → {controllerData.buttonB ? '✓ 検出中' : '未検出'}
                      </li>
                      <li className={Math.abs(controllerData.accelX) > 0.1 || Math.abs(controllerData.accelY) > 0.1 ? 'text-green-400 font-bold' : ''}>
                        • デバイスを傾ける → {Math.abs(controllerData.accelX) > 0.1 || Math.abs(controllerData.accelY) > 0.1 ? '✓ 検出中（青い点が動きます）' : '未検出'}
                      </li>
                    </ul>
                    <p className="text-xs text-gray-400 mt-4">操作が確認できたら「ゲーム開始」ボタンを押してください</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-bold mb-4">ゲーム説明</h3>
                    <ul className="text-left space-y-2 text-sm">
                      <li>• M5StickCplus2を接続してください</li>
                      <li>• デバイスを傾けてプレイヤーを移動</li>
                      <li>• 上から降ってくる黄色のターゲットに触れると自動的に取得</li>
                      <li>• 1つの単位・授業で4ポイント獲得</li>
                      <li>• 画面下まで落ちたターゲットは消えます</li>
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



