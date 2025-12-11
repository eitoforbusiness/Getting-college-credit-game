import Game from './components/Game';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full flex-col items-center justify-center py-8 px-4">
        <h1 className="text-4xl font-bold mb-2 text-center text-gray-900 dark:text-gray-100">
          M5StickC Plus 2 コントローラーゲーム
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 text-center">
          BLE経由でArduinoと接続してゲームを楽しもう
        </p>
        <Game />
      </main>
    </div>
  );
}
