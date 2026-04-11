import "./App.css";
import FramePicker from "./FramePicker";

function App() {
  return (
    <div className="app-wrapper">
      {/* Üst Kısım / İçerik */}
      <div style={{ flex: 1 }}> 
        <FramePicker />
      </div>

      {/* FOOTER - marginTop: 'auto' sayesinde en alta yapışır */}
      <footer style={{
        position: 'absolute',
        bottom: '5px', // Tam sıfıra yasladık (harfler kesilmesin diye 5px)
        left: '0',
        right: '0',
        textAlign: 'center',
        background: 'transparent',
        border: 'none',
        outline: 'none'
      }}>
        <p style={{ 
          fontSize: '16px', 
          color: '#ffffff',
          margin: 0,
          fontWeight: 'bold',
          textShadow: '0px 0px 8px rgba(0,0,0,0.6)' 
        }}>
          Bu uygulama {" "}
          <a 
            href="https://ozturksoft.net" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#ffffff', textDecoration: 'underline' }}
          >
            Ozturksoft
          </a>
          {" "} tarafından yapılmıştır.
        </p>
      </footer>
    </div>
  );
}

export default App;