'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import BluetoothController, { ControllerData } from './BluetoothController';

const SPECIAL_COURSES1 = [
  { id: 'statistics', label: '統計入門' },
  { id: 'info_exercise', label: '社会情報体験演習' },
  { id: 'social_science', label: '社会科学概論' },
  { id: 'human_science', label: '人間科学概論' },
  { id: 'info_science', label: '情報科学概論' },
  { id: 'communication_basic', label: 'コミュニケーション基礎' },
  { id: 'math', label: '数学' },
  { id: 'information_skill', label: '情報スキル' },
  { id: 'second_language', label: '第二外国語' },
  { id: 'physical_education', label: '体育' },
  { id: 'integrated_english', label: 'Integrated English' },
  { id: 'christian_introduction', label: 'キリスト教概論' },
] as const;

const SPECIAL_COURSES2 = [
  { id: 'project_exercise', label: 'プロジェクト演習入門' },
  { id: 'info_special_lecture', label: '社会情報特別講義' },
  { id: 'test_talking', label: 'Test-Talking-skill' },

] as const;

const SPECIAL_COURSES3 = [
  { id: 'seminar1', label: 'ゼミナールⅠ' },
  { id: 'seminar2', label: 'ゼミナールⅡ' },
] as const;

const SPECIAL_COURSES4 = [
  { id: 'experimentation1', label: '実験演習Ⅰ' },
  { id: 'experimentation2', label: '実験演習Ⅱ' },
] as const;

const ALL_SPECIAL_COURSES = [
  ...SPECIAL_COURSES1,
  ...SPECIAL_COURSES2,
  ...SPECIAL_COURSES3,
  ...SPECIAL_COURSES4,
] as const;

const REQUIRED_BY_END_OF_STAGE3 = [
  ...SPECIAL_COURSES1,
  ...SPECIAL_COURSES2,
  ...SPECIAL_COURSES3,
] as const;

const REQUIRED_BY_END_OF_STAGE4 = [...SPECIAL_COURSES4] as const;

const getSpecialCoursesForStage = (stageId: number) => {
  if (stageId === 1) return SPECIAL_COURSES1;
  if (stageId === 2) return [...SPECIAL_COURSES1, ...SPECIAL_COURSES2];
  if (stageId === 3)
    return [...SPECIAL_COURSES1, ...SPECIAL_COURSES2, ...SPECIAL_COURSES3];
  return SPECIAL_COURSES4;
};

const AoyamaStandards = [
  { id: 'aoyama_standard_course1', label: '青スタ' },
  { id: 'aoyama_standard_course2', label: '青スタ' },
] as const;

type SpecialCourseId = (typeof ALL_SPECIAL_COURSES)[number]['id'];

type Target = {
  id: number;
  x: number;
  y: number;
  kind: 'credit' | 'course';
  label: string;
  courseId?: SpecialCourseId;
};

const STAGE_CONFIG = [
  { id: 1, label: '1ステージ', spawnIntervalMs: 800, fallSpeed: 2 },
  { id: 2, label: '2ステージ', spawnIntervalMs: 800, fallSpeed: 2 },
  { id: 3, label: '3ステージ', spawnIntervalMs: 800, fallSpeed: 2 },
  { id: 4, label: '4ステージ', spawnIntervalMs: 800, fallSpeed: 2 },
] as const;

const MAX_SCORE = 124;
const MAX_ACTIVE_TARGETS = 2; // 画面上に同時に存在できる最大数
const CREDITS_PER_TARGET = 4; // 1つの単位・授業で加算される単位数
const MAX_COLLECTED_PER_STAGE = 48; // 1年間（1ステージ）で取得できる単位の上限（単位数）

export default function Game() {
  const [controllerData, setControllerData] = useState<ControllerData | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 50, y: 80 });
  const [score, setScore] = useState(0);
  const [collectedUnitsThisStage, setCollectedUnitsThisStage] = useState(0); // 各ステージで取得した単位数
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);
  const [isGraduated, setIsGraduated] = useState(false); // 卒業フラグ
  const [stage, setStage] = useState(1);
  const [targets, setTargets] = useState<Target[]>([]);
  const [spawnedTargetsThisStage, setSpawnedTargetsThisStage] = useState(0);
  const [showStageTransition, setShowStageTransition] = useState(false); // ステージ遷移時の表示フラグ
  const [obtainedCourseIds, setObtainedCourseIds] = useState<SpecialCourseId[]>([]);
  const targetIdRef = useRef(0);
  const scoredTargetIdsRef = useRef<Set<number>>(new Set());
  // 画面上に存在するターゲット数（同時出現数の制御）
  const activeTargetsCountRef = useRef(0);
  const playerPositionRef = useRef({ x: 50, y: 80 });
  // これまでに取得済みの特別科目（ゲーム中は二度と出現しない）
  const obtainedCoursesRef = useRef<Set<SpecialCourseId>>(new Set());
  // 各ステージで既に出現させた特別科目（同じ学年では1回だけ出現）
  const spawnedCoursesThisStageRef = useRef<Set<SpecialCourseId>>(new Set());
  // 各ステージで取得した単位数を参照するためのref
  const collectedUnitsThisStageRef = useRef(0);
  // 各ステージで出現した単位数を参照するためのref
  const spawnedTargetsThisStageRef = useRef(0);
  // 出現済みターゲットを重複カウントしないためのref
  const countedSpawnTargetIdsRef = useRef<Set<number>>(new Set());

  const currentStage = STAGE_CONFIG[stage - 1];
  const hasMissingRequiredCourses = useCallback(
    (requiredCourses: readonly { id: SpecialCourseId }[]) =>
      requiredCourses.some(course => !obtainedCoursesRef.current.has(course.id)),
    [],
  );
  const obtainedCourseIdSet = useMemo(
    () => new Set(obtainedCourseIds),
    [obtainedCourseIds],
  );
  const obtainedCourses = useMemo(
    () => ALL_SPECIAL_COURSES.filter(course => obtainedCourseIdSet.has(course.id)),
    [obtainedCourseIdSet],
  );
  const missingCourses = useMemo(
    () => ALL_SPECIAL_COURSES.filter(course => !obtainedCourseIdSet.has(course.id)),
    [obtainedCourseIdSet],
  );
  
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
  const triggerGameOver = useCallback((reason?: string) => {
    setGameStarted(false);
    setGameOver(true);
    setGameOverReason(reason ?? null);
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

  // 出現数が変わるたびにrefを更新
  useEffect(() => {
    spawnedTargetsThisStageRef.current = spawnedTargetsThisStage;
  }, [spawnedTargetsThisStage]);

  // 出現したターゲットを数える（重複カウント防止）
  useEffect(() => {
    if (!gameStarted) return;
    let newlyCounted = 0;
    targets.forEach(target => {
      if (!countedSpawnTargetIdsRef.current.has(target.id)) {
        countedSpawnTargetIdsRef.current.add(target.id);
        if (target.kind === 'course' && target.courseId) {
          spawnedCoursesThisStageRef.current.add(target.courseId);
        }
        newlyCounted += 1;
      }
    });
    if (newlyCounted > 0) {
      const increment = newlyCounted * CREDITS_PER_TARGET;
      spawnedTargetsThisStageRef.current += increment;
      setSpawnedTargetsThisStage(c => c + increment);
    }
  }, [gameStarted, targets]);

  // 出現上限に達し、全て落ち切ったら次のステージへ進む
  useEffect(() => {
    if (!gameStarted) return;

    const spawnedLimitReached =
      spawnedTargetsThisStage >= MAX_COLLECTED_PER_STAGE;
    const allTargetsCleared = targets.length === 0;

    // 4年生で出現上限に達した時の処理
    if (spawnedLimitReached && allTargetsCleared && stage === 4) {
      if (hasMissingRequiredCourses(REQUIRED_BY_END_OF_STAGE4)) {
        triggerGameOver('4年生の必修特別授業を取りきれませんでした。');
        return;
      }

      if (score < 124) {
        // スコアが124未満ならゲームオーバー
        triggerGameOver('スコアが124に届きませんでした。');
      } else {
        // スコアが124以上なら卒業
        setGameStarted(false);
        setIsGraduated(true);
        setTargets([]);
        activeTargetsCountRef.current = 0;
      }
      return;
    }
    
    if (spawnedLimitReached && allTargetsCleared && stage < STAGE_CONFIG.length) {
      // 大学4年生になる前（=3年生の終了時点）にスコアが90未満ならゲームオーバー
      if (stage === 3) {
        if (hasMissingRequiredCourses(REQUIRED_BY_END_OF_STAGE3)) {
          triggerGameOver('3年生終了までに必要な必修科目を取りきれませんでした。');
          return;
        }
        if (score < 90) {
          triggerGameOver('大学4年生になるまでに必要な取得単位(90)に届きませんでした。');
          return;
        }
      }

      // ステージ遷移の表示を出す
      setShowStageTransition(true);
      
      // 1秒後に次のステージへ進む
      const timer = setTimeout(() => {
        setStage(prev => prev + 1);
        setTargets([]);
        activeTargetsCountRef.current = 0;
        setPlayerPosition(updatePlayerPosition({ x: 50, y: 80 }));
        // 新しい学年に進んだら、その学年での出現履歴をリセット
        spawnedCoursesThisStageRef.current = new Set();
        setSpawnedTargetsThisStage(0);
        spawnedTargetsThisStageRef.current = 0;
        countedSpawnTargetIdsRef.current = new Set();
        setCollectedUnitsThisStage(0);
        collectedUnitsThisStageRef.current = 0;
        setShowStageTransition(false);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [
    gameStarted,
    collectedUnitsThisStage,
    spawnedTargetsThisStage,
    targets.length,
    stage,
    score,
    hasMissingRequiredCourses,
    triggerGameOver,
  ]);

  // ターゲット生成
  useEffect(() => {
    if (!gameStarted) return;

    const intervalMs = currentStage.spawnIntervalMs;

    const interval = setInterval(() => {
      // 取得上限に達したら生成を止める
      const spawnedCredits = spawnedTargetsThisStageRef.current;
      if (spawnedCredits >= MAX_COLLECTED_PER_STAGE) return;

      // 生成は setTargets の updater 内で原子的にガードして、同時出現数を制御する
      setTargets(prev => {
        // 画面上の上限数に達していたら生成しない
        if (prev.length >= MAX_ACTIVE_TARGETS) return prev;

        // updater 内でも上限制限を再チェック（競合やタイミングずれ対策）
        const spawnedCreditsInside = spawnedTargetsThisStageRef.current;
        if (spawnedCreditsInside >= MAX_COLLECTED_PER_STAGE)
          return prev;

        // まだ取得しておらず、かつ今のステージでまだ出現させていない特別科目の候補
        const availableSpecialCourses = getSpecialCoursesForStage(stage).filter(
          c =>
            !obtainedCoursesRef.current.has(c.id) &&
            !spawnedCoursesThisStageRef.current.has(c.id),
        );

        let newTarget: Target;

        // 学年の最初は特別授業を優先して落とす（残りが0になったら通常単位）
        if (availableSpecialCourses.length > 0) {
          const course =
            availableSpecialCourses[
              Math.floor(Math.random() * availableSpecialCourses.length)
            ];

          newTarget = {
            id: targetIdRef.current++,
            x: Math.random() * 80 + 10,
            y: 5, // 画面上部から出現
            kind: 'course',
            label: course.label,
            courseId: course.id,
          };
        } else if (stage === 1) {
          // 1年生は特別授業のみ（通常単位は落ちてこない）
          return prev;
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
  }, [gameStarted, currentStage.spawnIntervalMs, stage]);

  // ターゲットを下方向に落としつつ、プレイヤーとの衝突判定を行う
  useEffect(() => {
    if (!gameStarted) return;

    const fallSpeed = currentStage.fallSpeed; // 1ティックごとに落ちる量（%）
    const intervalMs = 80;

    const interval = setInterval(() => {
      setTargets(prevTargets => {
        const remaining: Target[] = [];
        let hitCount = 0;
        let remainingCapacity = Math.max(
          0,
          MAX_COLLECTED_PER_STAGE - collectedUnitsThisStageRef.current,
        );
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
              if (remainingCapacity >= CREDITS_PER_TARGET) {
                scoredTargetIdsRef.current.add(moved.id);
                hitCount += 1;
                remainingCapacity -= CREDITS_PER_TARGET;
                // 特別科目を取得したら、それ以降はどの学年にも落ちてこないようにする
                if (moved.kind === 'course' && moved.courseId) {
                  obtainedCourseIds.push(moved.courseId);
                }
              }
            }
            return; // このターゲットは削除
          }

          // 画面下（100%）まで到達したターゲットは削除
          if (moved.y > 100) {
            return;
          }

          remaining.push(moved);
        });

        // 1フレーム内で複数同時に取得/落下しても、必ず個数分まとめて加算する
        if (hitCount > 0) {
          setScore(s => s + hitCount * CREDITS_PER_TARGET); // 1つの単位・授業ごとに4点
          setCollectedUnitsThisStage(
            c => c + hitCount * CREDITS_PER_TARGET,
          );
        }

        if (obtainedCourseIds.length > 0) {
          obtainedCourseIds.forEach(id => obtainedCoursesRef.current.add(id));
          setObtainedCourseIds(prev => {
            const next = new Set(prev);
            obtainedCourseIds.forEach(id => next.add(id));
            return Array.from(next);
          });
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
    setStage(1);
    setShowStageTransition(false);
    setGameOver(false);
    setGameOverReason(null);
    setIsGraduated(false);
    setObtainedCourseIds([]);
    setPlayerPosition(updatePlayerPosition({ x: 50, y: 80 }));
    setTargets([]);
    activeTargetsCountRef.current = 0;
    setSpawnedTargetsThisStage(0);
    spawnedTargetsThisStageRef.current = 0;
    countedSpawnTargetIdsRef.current = new Set();
    targetIdRef.current = 0;
    scoredTargetIdsRef.current = new Set();
    obtainedCoursesRef.current = new Set();
    spawnedCoursesThisStageRef.current = new Set();
    collectedUnitsThisStageRef.current = 0;
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
      
      <div className="w-full flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-72 shrink-0 bg-white/80 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
            特別授業チェック
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
                取得済み ({obtainedCourses.length})
              </p>
              {obtainedCourses.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  まだ取得できていません
                </p>
              ) : (
                <ul className="space-y-1 text-xs text-gray-800 dark:text-gray-200">
                  {obtainedCourses.map(course => (
                    <li key={course.id} className="flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                      <span>{course.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">
                未取得 ({missingCourses.length})
              </p>
              {missingCourses.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  すべて取得済みです
                </p>
              ) : (
                <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                  {missingCourses.map(course => (
                    <li key={course.id} className="flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 rounded-full bg-red-400" />
                      <span>{course.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>

        <div className="flex-1">
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
                この学年で出現した単位（累計）: {spawnedTargetsThisStage}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                いま画面上に落ちている単位・特別授業: {targets.length}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                この学年で取得した単位: {collectedUnitsThisStage} / {MAX_COLLECTED_PER_STAGE}
              </span>
              {stage < STAGE_CONFIG.length ? (
                <span>
                  {MAX_COLLECTED_PER_STAGE}単位分が出現すると次の学年へ進みます
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
                  {gameOverReason ??
                    (stage === 4
                      ? 'スコアが124に届きませんでした。'
                      : '大学4年生になるまでにスコア90に届きませんでした。')}
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
                    <p className="mb-4 text-sm">M5StickCplus2が接続されました。</p>

                    <p className="text-xs text-gray-400 mt-4">「ゲーム開始」ボタンを押してください</p>
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
    </div>
  );
}



