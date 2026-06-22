import "./App.css";
import FramePicker from "./FramePicker";

function App() {
  return (
    <div className="app-wrapper">
      <main className="app-main">
        <FramePicker />
      </main>

      <footer className="app-footer">
        <div className="app-footer-line" aria-hidden="true" />
        <p className="app-footer-text">
          Geliştirici{" "}
          <a
            href="https://ozturksoft.net"
            target="_blank"
            rel="noopener noreferrer"
            className="app-footer-link"
          >
            Ozturksoft
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
