/*
 * M5StickCplus2 BLE Controller for Web Game
 * 
 * このスケッチは、M5StickCplus2をWebブラウザのゲームコントローラーとして使用するためのものです。
 * Web Bluetooth API経由でセンサーデータとボタン状態を送信します。
 * 
 * 必要なライブラリ:
 * - M5StickCPlus2 (M5Stack公式ライブラリ)
 * - ArduinoBLE
 * 
 * セットアップ手順:
 * 1. Arduino IDEにM5StackライブラリとArduinoBLEライブラリをインストール
 * 2. ボードマネージャーでM5StickCPlus2のボードを追加
 * 3. このスケッチをアップロード
 * 4. Webブラウザで http://localhost:3000 を開いて接続
 */

#include <M5StickCPlus2.h>
#include <ArduinoBLE.h>

// BLE Service UUID (Web側と一致させる必要があります)
#define SERVICE_UUID "12345678-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID "12345678-1234-1234-1234-123456789abd"

BLEService controllerService(SERVICE_UUID);
BLECharacteristic controllerCharacteristic(CHARACTERISTIC_UUID, BLENotify, 16);

// データ送信間隔（ミリ秒）
const unsigned long SEND_INTERVAL = 50; // 20Hz
unsigned long lastSendTime = 0;

// ボタン状態
bool buttonAState = false;
bool buttonBState = false;
bool lastButtonAState = false;
bool lastButtonBState = false;

void setup() {
  // M5StickCplus2の初期化
  auto cfg = M5.config();
  StickCP2.begin(cfg);
  StickCP2.Display.setRotation(1);
  StickCP2.Display.setTextColor(GREEN);
  StickCP2.Display.setTextDatum(middle_center);
  StickCP2.Display.setTextSize(2);
  
  // BLEの初期化
  if (!BLE.begin()) {
    StickCP2.Display.fillScreen(RED);
    StickCP2.Display.drawString("BLE Init", StickCP2.Display.width() / 2, StickCP2.Display.height() / 2);
    while (1) {
      delay(1000);
    }
  }
  
  // BLEサービスとキャラクタリスティックの設定
  BLE.setLocalName("M5StickCplus2-Controller");
  BLE.setAdvertisedService(controllerService);
  controllerService.addCharacteristic(controllerCharacteristic);
  BLE.addService(controllerService);
  
  // BLEアドバタイズ開始
  BLE.advertise();
  
  // 画面表示
  StickCP2.Display.fillScreen(BLACK);
  StickCP2.Display.drawString("BLE Ready", StickCP2.Display.width() / 2, StickCP2.Display.height() / 2 - 20);
  StickCP2.Display.setTextSize(1);
  StickCP2.Display.drawString("Waiting...", StickCP2.Display.width() / 2, StickCP2.Display.height() / 2 + 20);
  
  delay(1000);
}

void loop() {
  // BLE接続の確認
  BLEDevice central = BLE.central();
  
  if (central) {
    // 接続中
    if (central.connected()) {
      // ボタン状態の読み取り
      StickCP2.update();
      buttonAState = StickCP2.BtnA.wasPressed();
      buttonBState = StickCP2.BtnB.wasPressed();
      
      // 定期的にデータを送信
      unsigned long currentTime = millis();
      if (currentTime - lastSendTime >= SEND_INTERVAL) {
        sendControllerData();
        lastSendTime = currentTime;
      }
      
      // 画面更新（接続状態とボタン状態を表示）
      updateDisplay(true, buttonAState, buttonBState);
    } else {
      // 切断された
      updateDisplay(false, false, false);
    }
  } else {
    // 接続待機中
    updateDisplay(false, false, false);
  }
  
  delay(10);
}

void sendControllerData() {
  // IMUデータの取得
  auto imu_update = StickCP2.Imu.update();
  if (imu_update) {
    auto data = StickCP2.Imu.getImuData();
    
    // データパケットの作成
    // 形式: [buttonA(1byte), buttonB(1byte), accelX(2byte), accelY(2byte), accelZ(2byte), gyroX(2byte), gyroY(2byte), gyroZ(2byte)]
    uint8_t dataPacket[16];
    int offset = 0;
    
    // ボタン状態（1バイトずつ）
    dataPacket[offset++] = buttonAState ? 1 : 0;
    dataPacket[offset++] = buttonBState ? 1 : 0;
    
    // 加速度データ（G単位、1000倍してint16_tに変換）
    int16_t accelX = (int16_t)(data.accel.x * 1000);
    int16_t accelY = (int16_t)(data.accel.y * 1000);
    int16_t accelZ = (int16_t)(data.accel.z * 1000);
    
    memcpy(&dataPacket[offset], &accelX, 2); offset += 2;
    memcpy(&dataPacket[offset], &accelY, 2); offset += 2;
    memcpy(&dataPacket[offset], &accelZ, 2); offset += 2;
    
    // ジャイロデータ（度/秒単位、100倍してint16_tに変換）
    int16_t gyroX = (int16_t)(data.gyro.x * 100);
    int16_t gyroY = (int16_t)(data.gyro.y * 100);
    int16_t gyroZ = (int16_t)(data.gyro.z * 100);
    
    memcpy(&dataPacket[offset], &gyroX, 2); offset += 2;
    memcpy(&dataPacket[offset], &gyroY, 2); offset += 2;
    memcpy(&dataPacket[offset], &gyroZ, 2); offset += 2;
    
    // BLE経由でデータを送信
    controllerCharacteristic.writeValue(dataPacket, 16);
  }
}

void updateDisplay(bool connected, bool btnA, bool btnB) {
  static bool lastConnected = false;
  static bool lastBtnA = false;
  static bool lastBtnB = false;
  
  // 状態が変わった時だけ画面を更新
  if (connected != lastConnected || btnA != lastBtnA || btnB != lastBtnB) {
    StickCP2.Display.fillScreen(BLACK);
    StickCP2.Display.setTextSize(2);
    StickCP2.Display.setTextColor(connected ? GREEN : YELLOW);
    StickCP2.Display.drawString(
      connected ? "Connected" : "Waiting",
      StickCP2.Display.width() / 2,
      20
    );
    
    StickCP2.Display.setTextSize(1);
    StickCP2.Display.setTextColor(WHITE);
    StickCP2.Display.drawString("BtnA:", 10, 60);
    StickCP2.Display.drawString("BtnB:", 10, 80);
    
    StickCP2.Display.setTextColor(btnA ? GREEN : GRAY);
    StickCP2.Display.drawString(btnA ? "ON" : "OFF", 60, 60);
    
    StickCP2.Display.setTextColor(btnB ? GREEN : GRAY);
    StickCP2.Display.drawString(btnB ? "ON" : "OFF", 60, 80);
    
    lastConnected = connected;
    lastBtnA = btnA;
    lastBtnB = btnB;
  }
}

