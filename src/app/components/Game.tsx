'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import BluetoothController, { ControllerData } from './BluetoothController';

export default function Game() {
  const [controllerData, setControllerData] = useState<ControllerData | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 50, y: 50 });
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [targets, setTargets] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const targetIdRef = useRef(0);
  const buttonAPressedRef = useRef(false);
  const playerPositionRef = useRef({ x: 50, y: 50 });

  const clampToField = (value: number) => Math.max(5, Math.min(95, value));

  const updatePlayerPosition = (next: { x: number; y: number }) => {
    playerPositionRef.current = next;
    return next;
  };

  // 加速度からロール・ピッチを算出し、デッドゾーン＋感度で移動量に変換
  const tiltToDelta = (data: ControllerData) => {
    // ロール: 左右の傾き / ピッチ: 前後の傾き
    const rollRad = Math.atan2(data.accelY, data.accelZ);
    const pitchRad = Math.atan2(-data.accelX, Math.sqrt(data.accelY * data.accelY + data.accelZ * data.accelZ));

    const rollDeg = (rollRad * 180) / Math.PI;
    const pitchDeg = (pitchRad * 180) / Math.PI;

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
      deltaY: applyCurve(pitchDeg),
    };
  };

  const handleDataReceived = useCallback((data: ControllerData) => {
    setControllerData(data);

    const { deltaX, deltaY } = tiltToDelta(data);
    // テストモード／ゲーム中どちらでも傾きで移動
    setPlayerPosition(prev => updatePlayerPosition({
      x: clampToField(prev.x + deltaX),
      y: clampToField(prev.y + deltaY),
    }));

    // ボタンAでスコア加算（押下の瞬間のみ）
    if (data.buttonA && !buttonAPressedRef.current) {
      buttonAPressedRef.current = true;
      // ターゲットとの衝突判定
      setTargets(prev => {
        const newTargets = prev.filter(target => {
          const distance = Math.sqrt(
            Math.pow(target.x - playerPositionRef.current.x, 2) + 
            Math.pow(target.y - playerPositionRef.current.y, 2)
          );
          if (distance < 8) {
            setScore(s => s + 10);
            return false; // ターゲットを削除
          }
          return true;
        });
        return newTargets;
      });
    } else if (!data.buttonA) {
      buttonAPressedRef.current = false;
    }
  }, [gameStarted, playerPosition]);

  // ターゲット生成
  useEffect(() => {
    if (!gameStarted) return;

    const interval = setInterval(() => {
      setTargets(prev => {
        const newTarget = {
          id: targetIdRef.current++,
          x: Math.random() * 80 + 10,
          y: Math.random() * 80 + 10,
        };
        return [...prev, newTarget];
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [gameStarted]);

  // ターゲットの自動削除（10秒後）
  useEffect(() => {
    if (!gameStarted) return;

    const interval = setInterval(() => {
      setTargets(prev => {
        if (prev.length > 0) {
          return prev.slice(1);
        }
        return prev;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [gameStarted]);

  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setPlayerPosition(updatePlayerPosition({ x: 50, y: 50 }));
    setTargets([]);
    targetIdRef.current = 0;
  };

  const stopGame = () => {
    setGameStarted(false);
    setTargets([]);
    setPlayerPosition(updatePlayerPosition({ x: 50, y: 50 }));
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 w-full max-w-4xl">
      <BluetoothController onDataReceived={handleDataReceived} />
      
      <div className="w-full">
        <div className="mb-4 text-center">
          <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            スコア: {score}
          </h2>
          <div className="flex gap-4 justify-center mt-4">
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
        <div className="relative w-full h-96 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-700 shadow-lg">
          {/* プレイヤー */}
          <div
            className="absolute w-8 h-8 bg-blue-500 rounded-full transition-all duration-100 shadow-lg border-2 border-white"
            style={{
              left: `${playerPosition.x}%`,
              top: `${playerPosition.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
          
          {/* ターゲット */}
          {targets.map(target => (
            <div
              key={target.id}
              className="absolute w-6 h-6 bg-yellow-400 rounded-full animate-pulse border-2 border-yellow-600 shadow-md"
              style={{
                left: `${target.x}%`,
                top: `${target.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
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
                      <li>• 黄色のターゲットに近づいてボタンAで取得</li>
                      <li>• 1つのターゲットで10ポイント獲得</li>
                      <li>• ターゲットは10秒で消えます</li>
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* コントローラーデータ表示（リアルタイム確認用） */}
        {controllerData && (
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
            <h3 className="font-bold mb-3 text-gray-900 dark:text-gray-100">
              M5StickCplus2 リアルタイムデータ
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className={`p-2 rounded ${controllerData.buttonA ? 'bg-green-200 dark:bg-green-900' : 'bg-gray-200 dark:bg-gray-700'}`}>
                <div className="font-semibold mb-1">ボタンA</div>
                <div className={controllerData.buttonA ? 'text-green-700 dark:text-green-300 font-bold' : 'text-gray-600 dark:text-gray-400'}>
                  {controllerData.buttonA ? '● 押されています' : '○ 離されています'}
                </div>
              </div>
              <div className={`p-2 rounded ${controllerData.buttonB ? 'bg-green-200 dark:bg-green-900' : 'bg-gray-200 dark:bg-gray-700'}`}>
                <div className="font-semibold mb-1">ボタンB</div>
                <div className={controllerData.buttonB ? 'text-green-700 dark:text-green-300 font-bold' : 'text-gray-600 dark:text-gray-400'}>
                  {controllerData.buttonB ? '● 押されています' : '○ 離されています'}
                </div>
              </div>
              <div className="p-2 rounded bg-blue-50 dark:bg-blue-900">
                <div className="font-semibold mb-1">加速度 X</div>
                <div className="text-blue-700 dark:text-blue-300">
                  {controllerData.accelX.toFixed(3)} G
                </div>
              </div>
              <div className="p-2 rounded bg-blue-50 dark:bg-blue-900">
                <div className="font-semibold mb-1">加速度 Y</div>
                <div className="text-blue-700 dark:text-blue-300">
                  {controllerData.accelY.toFixed(3)} G
                </div>
              </div>
              <div className="p-2 rounded bg-blue-50 dark:bg-blue-900">
                <div className="font-semibold mb-1">加速度 Z</div>
                <div className="text-blue-700 dark:text-blue-300">
                  {controllerData.accelZ.toFixed(3)} G
                </div>
              </div>
              <div className="p-2 rounded bg-purple-50 dark:bg-purple-900">
                <div className="font-semibold mb-1">ジャイロ X</div>
                <div className="text-purple-700 dark:text-purple-300">
                  {controllerData.gyroX.toFixed(1)} °/s
                </div>
              </div>
              <div className="p-2 rounded bg-purple-50 dark:bg-purple-900">
                <div className="font-semibold mb-1">ジャイロ Y</div>
                <div className="text-purple-700 dark:text-purple-300">
                  {controllerData.gyroY.toFixed(1)} °/s
                </div>
              </div>
              <div className="p-2 rounded bg-purple-50 dark:bg-purple-900">
                <div className="font-semibold mb-1">ジャイロ Z</div>
                <div className="text-purple-700 dark:text-purple-300">
                  {controllerData.gyroZ.toFixed(1)} °/s
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



