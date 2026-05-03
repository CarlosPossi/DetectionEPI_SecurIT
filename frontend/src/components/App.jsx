import WebcamDetection from "./components/WebcamDetection";

function App() {
  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <h1 style={{ position: "absolute", zIndex: 10 }}>
        Monitoramento de EPI
      </h1>

      <WebcamDetection />
    </div>
  );
}

export default App;