'use client';

import { useState, useCallback } from 'react';

export interface ControllerData {
  buttonA: boolean;
  buttonB: boolean;
  accelX: number;
  accelY: number;
  accelZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
}

interface BluetoothControllerProps {
  onDataReceived: (data: ControllerData) => void;
}

// BLE Service UUID (M5StickCplus2側と一致させる必要があります)
// カスタムUUIDを使用する場合、Arduino側のコードで同じUUIDを設定してください
const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const CHARACTERISTIC_UUID = '12345678-1234-1234-1234-123456789abd';

// M5StickCplus2の一般的なデバイス名（オプション）
const DEVICE_NAME_PREFIX = 'M5Stick';

export default function BluetoothController({ onDataReceived }: BluetoothControllerProps) {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>('');

  const connect = useCallback(async () => {
    try {
      setError(null);
      
      // Web Bluetooth APIが利用可能かチェック
      if (!navigator.bluetooth) {
        throw new Error('このブラウザはWeb Bluetooth APIをサポートしていません。Chrome、Edge、またはOperaをお使いください。');
      }
      
      // Web Bluetooth APIでデバイスに接続
      // まずサービスUUIDで検索を試みる
      let selectedDevice: BluetoothDevice;
      let searchMethod = '';
      
      try {
        searchMethod = 'サービスUUID';
        selectedDevice = await navigator.bluetooth.requestDevice({
          filters: [{ services: [SERVICE_UUID] }],
          optionalServices: [SERVICE_UUID],
        });
      } catch (serviceError: any) {
        // サービスUUIDで見つからない場合、デバイス名で検索を試みる
        if (serviceError.name === 'NotFoundError') {
          try {
            searchMethod = 'デバイス名';
            selectedDevice = await navigator.bluetooth.requestDevice({
              filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
              optionalServices: [SERVICE_UUID],
            });
          } catch (nameError: any) {
            // デバイス名でも見つからない場合、エラーを再スロー
            throw nameError;
          }
        } else {
          throw serviceError;
        }
      }

      setDeviceName(selectedDevice.name || '不明なデバイス');

      const server = await selectedDevice.gatt?.connect();
      if (!server) throw new Error('GATTサーバーに接続できませんでした');

      // サービスを取得
      let service: BluetoothRemoteGATTService;
      try {
        service = await server.getPrimaryService(SERVICE_UUID);
      } catch (serviceError: any) {
        // サービスが見つからない場合、利用可能なサービスをリストアップ
        const services = await server.getPrimaryServices();
        throw new Error(`サービス ${SERVICE_UUID} が見つかりませんでした。利用可能なサービス: ${services.map(s => s.uuid).join(', ')}`);
      }

      // キャラクタリスティックを取得
      let characteristic: BluetoothRemoteGATTCharacteristic;
      try {
        characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      } catch (charError: any) {
        // キャラクタリスティックが見つからない場合、利用可能なものをリストアップ
        const characteristics = await service.getCharacteristics();
        throw new Error(`キャラクタリスティック ${CHARACTERISTIC_UUID} が見つかりませんでした。利用可能なキャラクタリスティック: ${characteristics.map(c => c.uuid).join(', ')}`);
      }

      // 通知を有効化
      await characteristic.startNotifications();
      
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (value) {
          try {
            const data = parseControllerData(value);
            onDataReceived(data);
          } catch (parseError) {
            console.error('データパースエラー:', parseError);
            setError(`データの解析に失敗しました: ${parseError}`);
          }
        }
      });

      setDevice(selectedDevice);
      setIsConnected(true);

      // 切断時の処理
      selectedDevice.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setDevice(null);
        setDeviceName('');
        setError('デバイスとの接続が切断されました。');
      });

    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        setError(`❌ M5StickCplus2が見つかりませんでした

【M5StickCplus2の画面確認】
M5StickCplus2の画面に以下が表示されているか確認してください：
✓ 「BLE Ready」と表示されている → 正常な状態
✓ 「Waiting...」と表示されている → 接続待ち状態
✗ 何も表示されていない → Arduinoスケッチがアップロードされていない可能性

【確認手順（順番に試してください）】

1. M5StickCplus2の画面を確認
   • 「BLE Ready」または「Waiting...」と表示されているか確認
   • 表示されていない場合、Arduinoスケッチを再アップロードしてください

2. M5StickCplus2を再起動
   • リセットボタン（側面の小さなボタン）を押す
   • 画面に「BLE Ready」と表示されるまで待つ（約2-3秒）

3. 他のデバイスとの接続を確認
   • 他のスマートフォンやPCと既に接続している場合、検出されません
   • 他のデバイスから切断してから再度試してください

4. 距離と環境を確認
   • M5StickCplus2とパソコンを1メートル以内に配置
   • 金属や電子機器の近くは避ける
   • USBケーブルは外してもOK（電源は別途供給）

5. ブラウザの再試行
   • 10秒ほど待ってから再度「M5StickCplus2に接続」ボタンをクリック
   • M5StickCplus2の画面が「BLE Ready」と表示されている状態で試す

6. Arduinoスケッチの確認
   • SERVICE_UUID: '12345678-1234-1234-1234-123456789abc'
   • デバイス名: 'M5StickCplus2-Controller'
   • スケッチを再アップロードしてみてください`);
      } else if (err.name === 'SecurityError') {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isWindows = navigator.platform.toUpperCase().indexOf('WIN') >= 0;
        const isLinux = navigator.platform.toUpperCase().indexOf('LINUX') >= 0;
        
        let platformInstructions = '';
        if (isMac) {
          platformInstructions = `
【macOSの場合】
1. システム設定（システム環境設定）を開く
2. 「プライバシーとセキュリティ」を選択
3. 「Bluetooth」を選択
4. ブラウザ（Chrome/Edge）にチェックを入れる
5. ブラウザを再起動してから再度接続を試してください`;
        } else if (isWindows) {
          platformInstructions = `
【Windowsの場合】
1. Windowsの設定を開く
2. 「プライバシー」→「Bluetooth」を選択
3. 「アプリがBluetoothにアクセスできるようにする」をオンにする
4. ブラウザを再起動してから再度接続を試してください`;
        } else if (isLinux) {
          platformInstructions = `
【Linuxの場合】
1. Bluetoothサービスが起動しているか確認: sudo systemctl status bluetooth
2. ブラウザをBluetooth権限で実行する必要がある場合があります
3. ブラウザを再起動してから再度接続を試してください`;
        }
        
        setError(`❌ Bluetoothの権限がありません

【重要】このエラーは、M5StickCplus2との接続が確立されていない状態で発生しています。
デバイス選択ダイアログすら表示されず、Bluetoothデバイスのスキャンすらできていません。

${platformInstructions}

【共通の確認事項】
• Chrome、Edge、またはOperaブラウザを使用しているか確認
• localhostまたはHTTPS環境でアクセスしているか確認
• ブラウザのアドレスバー左側の鍵アイコンをクリックしてBluetooth権限を確認
• ブラウザを完全に終了してから再起動してから再度試してください`);
      } else if (err.name === 'NetworkError') {
        setError('ネットワークエラーが発生しました。デバイスとの接続を確認してください。');
      } else {
        setError(`接続エラー: ${err.message}`);
      }
      setIsConnected(false);
      setDevice(null);
      setDeviceName('');
    }
  }, [onDataReceived]);

  const disconnect = useCallback(() => {
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    }
    setIsConnected(false);
    setDevice(null);
    setDeviceName('');
    setError(null);
  }, [device]);

  // データパース関数（Arduino側のデータ形式に合わせて調整）
  const parseControllerData = (dataView: DataView): ControllerData => {
    // データ形式: [buttonA(1byte), buttonB(1byte), accelX(2byte), accelY(2byte), accelZ(2byte), gyroX(2byte), gyroY(2byte), gyroZ(2byte)]
    // 合計16バイト必要
    if (dataView.byteLength < 16) {
      throw new Error(`データサイズが不正です。期待値: 16バイト、実際: ${dataView.byteLength}バイト`);
    }

    let offset = 0;
    const buttonA = dataView.getUint8(offset++) !== 0;
    const buttonB = dataView.getUint8(offset++) !== 0;
    const accelX = dataView.getInt16(offset, true) / 1000; offset += 2;
    const accelY = dataView.getInt16(offset, true) / 1000; offset += 2;
    const accelZ = dataView.getInt16(offset, true) / 1000; offset += 2;
    const gyroX = dataView.getInt16(offset, true) / 100; offset += 2;
    const gyroY = dataView.getInt16(offset, true) / 100; offset += 2;
    const gyroZ = dataView.getInt16(offset, true) / 100;

    return {
      buttonA,
      buttonB,
      accelX,
      accelY,
      accelZ,
      gyroX,
      gyroY,
      gyroZ,
    };
  };

  return (
    <div className="w-full p-4 border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        M5StickCplus2 コントローラー
      </h2>
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded border border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700">
          <div className="font-bold mb-2">⚠️ エラーが発生しました</div>
          <div className="text-sm whitespace-pre-line">{error}</div>
        </div>
      )}
      <div className="flex gap-4 items-center flex-wrap">
        {!isConnected ? (
          <button
            onClick={connect}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            M5StickCplus2に接続
          </button>
        ) : (
          <>
            <button
              onClick={disconnect}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              切断
            </button>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg dark:bg-green-900 dark:text-green-200 font-medium">
                接続中: {deviceName}
              </span>
            </div>
          </>
        )}
      </div>
      {!navigator.bluetooth && (
        <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded border border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700">
          <div className="font-bold mb-1">⚠️ Web Bluetooth APIが利用できません</div>
          <div className="text-sm">
            <p className="mb-2">Web Bluetooth APIは以下の環境でのみ動作します：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Chrome、Edge、またはOperaブラウザを使用している</li>
              <li>HTTPS環境またはlocalhostでアクセスしている</li>
              <li>ブラウザがWeb Bluetooth APIをサポートしている</li>
            </ul>
            <p className="mt-2">現在のURLが <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">http://localhost:3000</code> または <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">https://</code> で始まっているか確認してください。</p>
          </div>
        </div>
      )}
      {isConnected && (
        <p className="mt-4 text-sm text-green-600 dark:text-green-400">
          ✓ M5StickCplus2と接続されました。デバイスを操作してデータが表示されることを確認してください。
        </p>
      )}
    </div>
  );
}



