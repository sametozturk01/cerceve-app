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
  width: '100%',
  textAlign: 'center',
  padding: '10px 0',
  marginTop: 'auto',
  background: 'transparent', // Bant görüntüsünü tamamen yok eder
  border: 'none',
  outline: 'none'
}}>
  <p style={{ 
    fontSize: '15px', 
    color: '#ffffff',
    margin: 0,
    fontWeight: '600',
    /* Yazı etrafındaki gölgeyi yumuşattık */
    textShadow: '0 2px 4px rgba(0,0,0,0.3)' 
  }}>
    Bu uygulama {" "}
    <a 
      href="https://ozturksoft.net" 
      target="_blank" 
      rel="noopener noreferrer"
      style={{
        color: '#ffffff',
        textDecoration: 'underline',
        fontWeight: '800'
      }}
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