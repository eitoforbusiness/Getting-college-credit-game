'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import BluetoothController, { ControllerData } from './BluetoothController';

const STAGE_CONFIG = [
  { id: 1, label: '1ステージ', targetScore: 30, spawnIntervalMs: 2000, fallSpeed: 1.0 },
  { id: 2, label: '2ステージ', targetScore: 70, spawnIntervalMs: 1700, fallSpeed: 1.3 },
  { id: 3, label: '3ステージ', targetScore: 120, spawnIntervalMs: 1400, fallSpeed: 1.6 },
  { id: 4, label: '4ステージ', targetScore: 180, spawnIntervalMs: 1200, fallSpeed: 1.9 },
] as const;

export default function Game() {
  const [controllerData, setControllerData] = useState<ControllerData | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 50, y: 80 });
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [stage, setStage] = useState(1);
  const [targets, setTargets] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const targetIdRef = useRef(0);
  const scoredTargetIdsRef = useRef<Set<number>>(new Set());
  const playerPositionRef = useRef({ x: 50, y: 80 });

  const currentStage = STAGE_CONFIG[stage - 1];
  const canGoNextStage =
    stage < STAGE_CONFIG.length && score >= currentStage.targetScore;

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

  // ターゲット生成
  useEffect(() => {
    if (!gameStarted) return;

    const intervalMs = currentStage.spawnIntervalMs;

    const interval = setInterval(() => {
      setTargets(prev => {
        const newTarget = {
          id: targetIdRef.current++,
          x: Math.random() * 80 + 10,
          y: 5, // 画面上部から出現
        };
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
        const remaining: Array<{ id: number; x: number; y: number }> = [];

        prevTargets.forEach(target => {
          const moved = { ...target, y: target.y + fallSpeed };

          // プレイヤーとの衝突判定（少しでも重なったらヒット）
          const dx = moved.x - playerPositionRef.current.x;
          const dy = moved.y - playerPositionRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const hitRadius = 7; // 当たり判定の広さ

          if (distance < hitRadius) {
            // まだスコア加算していないターゲットだけ加算
            if (!scoredTargetIdsRef.current.has(moved.id)) {
              scoredTargetIdsRef.current.add(moved.id);
              setScore(s => s + 2); // ヒットしたら2点追加
            }
            return; // このターゲットは削除
          }

          // 画面下（100%）まで到達したターゲットは削除
          if (moved.y <= 100) {
            remaining.push(moved);
          }
        });

        return remaining;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [gameStarted, currentStage.fallSpeed]);

  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setStage(1);
    setPlayerPosition(updatePlayerPosition({ x: 50, y: 80 }));
    setTargets([]);
    targetIdRef.current = 0;
  };

  const stopGame = () => {
    setGameStarted(false);
    setTargets([]);
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
            <div className="text-sm text-gray-700 dark:text-gray-300 flex flex-col items-center gap-1">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-100 text-sm font-semibold">
                現在のステージ: {currentStage.label}
              </span>
              {stage < STAGE_CONFIG.length ? (
                <span>
                  次のステージ条件: スコア {currentStage.targetScore} 以上
                </span>
              ) : (
                <span>最終ステージです</span>
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

            {/* 次のステージへ進むボタン */}
            {stage < STAGE_CONFIG.length && (
              <button
                onClick={() => {
                  if (!canGoNextStage) return;
                  setStage(prev => prev + 1);
                  setTargets([]);
                  setPlayerPosition(updatePlayerPosition({ x: 50, y: 80 }));
                }}
                disabled={!canGoNextStage}
                className={`px-6 py-3 rounded-lg font-medium text-lg border transition-colors ${
                  canGoNextStage
                    ? 'bg-indigo-500 text-white border-indigo-600 hover:bg-indigo-600'
                    : 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed'
                }`}
              >
                次のステージへ
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
              単位
            </div>
          ))}

          {/* ゲーム説明 / 操作確認モード */}
          {!gameStarted && (
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
                      <li>• 1つのターゲットで10ポイント獲得</li>
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



