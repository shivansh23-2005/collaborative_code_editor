import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import AuthPage from "./AuthPage.jsx";
import Dashboard from "./Dashboard.jsx";
import "./App.css";

const LANGUAGES = [
  { label: "Java", value: "java" },
  { label: "Python", value: "python" },
  { label: "C++", value: "cpp" },
  { label: "C", value: "c" },
  { label: "JavaScript", value: "javascript" },
];

function CodeEditor({ onBack }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("collabcode-theme") || "dark"
  );
  const [language, setLanguage] = useState(
    () => localStorage.getItem("collabcode-language") || "java"
  );
  const [activeSidebar, setActiveSidebar] = useState("explorer");
  const [outputOpen, setOutputOpen] = useState(true);

  const socket = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const applyingRemote = useRef(false);
  const versionRef = useRef(0);

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session") || "ABC123";

  const [code, setCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    localStorage.setItem("collabcode-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("collabcode-language", language);
  }, [language]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";
    const ws = new WebSocket(`${WS_URL}/ws`);
    socket.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "join", sessionId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "code") {
          applyingRemote.current = true;
          setCode(data.code || "");

          const model = editorRef.current?.getModel();
          if (model && model.getValue() !== (data.code || "")) {
            model.setValue(data.code || "");
          }

          if (typeof data.version === "number") {
            versionRef.current = data.version;
          }

          window.setTimeout(() => {
            applyingRemote.current = false;
          }, 50);
          return;
        }

        if (data.type === "version") {
          versionRef.current = data.version;
          return;
        }

        if (data.type === "users") {
          setUserCount(data.count || 0);
          return;
        }

        if (data.type === "operation") {
          applyRemoteOperation(data);
        }
      } catch (error) {
        console.error("Message parsing error:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
      if (socket.current === ws) socket.current = null;
    };
    // Connect once for this room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const applyRemoteOperation = useCallback((operation) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!model) return;

    applyingRemote.current = true;

    const position = Math.max(
      0,
      Math.min(Number(operation.position) || 0, model.getValueLength())
    );
    const deleteCount = Math.max(
      0,
      Math.min(
        Number(operation.deleteCount) || 0,
        model.getValueLength() - position
      )
    );

    const start = model.getPositionAt(position);
    const end = model.getPositionAt(position + deleteCount);

    editor.executeEdits("remote-operation", [
      {
        range: {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        },
        text: operation.text || "",
      },
    ]);

    setCode(model.getValue());

    if (typeof operation.version === "number") {
      versionRef.current = operation.version;
    }

    window.setTimeout(() => {
      applyingRemote.current = false;
    }, 50);
  }, []);

  const sendHistoryAction = (action) => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) return;

    socket.current.send(JSON.stringify({ type: action, sessionId }));
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ,
      () => sendHistoryAction("undo")
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY,
      () => sendHistoryAction("redo")
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
      () => sendHistoryAction("redo")
    );
  };

  const handleEditorChange = (value, event) => {
    const newCode = value || "";
    setCode(newCode);

    if (applyingRemote.current) return;
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) return;
    if (!event?.changes?.length) return;

    const changes = [...event.changes].sort(
      (a, b) => b.rangeOffset - a.rangeOffset
    );

    for (const change of changes) {
      const baseVersion = versionRef.current;
      socket.current.send(
        JSON.stringify({
          type: "operation",
          sessionId,
          position: change.rangeOffset,
          deleteCount: change.rangeLength,
          text: change.text || "",
          baseVersion,
        })
      );
      versionRef.current = baseVersion + 1;
    }
  };

  const runCode = async () => {
    setRunning(true);
    setOutput("Running your code...");

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const response = await fetch(`${API_URL}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          sessionId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setOutput(data.error || data.message || "Code execution failed.");
      } else if (data.success) {
        setOutput(data.output || "Program executed successfully.");
      } else {
        setOutput(data.error || data.output || "Execution failed.");
      }
    } catch (error) {
      console.error("Code execution error:", error);
      setOutput("Could not connect to the execution server. Check that your backend is running.");
    } finally {
      setRunning(false);
    }
  };

  const sidebarItems = [
    { id: "explorer", label: "Explorer", icon: "▤" },
    { id: "search", label: "Search", icon: "⌕" },
    { id: "source", label: "Source Control", icon: "⑂" },
    { id: "collaboration", label: "Collaborators", icon: "♧" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];

  return (
    <div className={`editor-app ${theme}-mode`}>
      <header className="editor-titlebar">
        <div className="titlebar-left">
          <button className="icon-button back-button" onClick={onBack} title="Back to dashboard" aria-label="Back to dashboard">
            <span aria-hidden="true">←</span>
          </button>
          <div className="app-brand">
            <span className="brand-mark">{"</>"}</span>
            <span>CollabCode</span>
          </div>
          <span className="titlebar-divider" />
          <span className="room-label">Room <strong>{sessionId}</strong></span>
        </div>

        <div className="titlebar-actions">
          <span className={`connection-pill ${connected ? "is-connected" : "is-disconnected"}`}>
            <span className="connection-dot" />
            {connected ? "Connected" : "Connecting"}
          </span>
          <span className="user-count" title="Users in this room">♧ {userCount}</span>
          <button
            className="secondary-button share-button"
            onClick={() => {
              navigator.clipboard
                .writeText(window.location.href)
                .then(() => window.alert("Room link copied!"))
                .catch(() => window.alert("Could not copy the room link."));
            }}
          >
            <span aria-hidden="true">↗</span> Share
          </button>
          <button
            className="icon-button theme-button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☼" : "☾"}
          </button>
        </div>
      </header>

      <div className="editor-workspace">
        <nav className="activity-bar" aria-label="Editor sidebar">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              className={`activity-item ${activeSidebar === item.id ? "active" : ""}`}
              onClick={() => setActiveSidebar(item.id)}
              title={item.label}
              aria-label={item.label}
            >
              <span>{item.icon}</span>
            </button>
          ))}
          <div className="activity-spacer" />
          <button className="activity-item" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            <span>◐</span>
          </button>
        </nav>

        <aside className="side-panel">
          {activeSidebar === "explorer" && (
            <>
              <div className="side-panel-heading">EXPLORER</div>
              <div className="project-heading"><span>⌄</span> COLLABCODE</div>
              <button className="file-row selected-file">
                <span className="file-language-icon">{language === "java" ? "J" : language === "python" ? "Py" : language === "javascript" ? "JS" : "C"}</span>
                <span>{language === "java" ? "Main.java" : language === "python" ? "main.py" : language === "javascript" ? "main.js" : language === "cpp" ? "main.cpp" : "main.c"}</span>
              </button>
              <div className="side-panel-note">Shared room workspace</div>
            </>
          )}

          {activeSidebar === "search" && (
            <>
              <div className="side-panel-heading">SEARCH</div>
              <p className="side-panel-note">Search is ready for your workspace.</p>
              <input className="sidebar-input" placeholder="Search in files" aria-label="Search in files" />
            </>
          )}

          {activeSidebar === "source" && (
            <>
              <div className="side-panel-heading">SOURCE CONTROL</div>
              <p className="side-panel-note">Changes are shared through your room connection.</p>
              <div className="status-row"><span className="connection-dot" /> {connected ? "Room connected" : "Waiting for connection"}</div>
            </>
          )}

          {activeSidebar === "collaboration" && (
            <>
              <div className="side-panel-heading">COLLABORATORS</div>
              <div className="collaborator-card">
                <span className="avatar">Y</span>
                <div><strong>You</strong><small>Current editor</small></div>
              </div>
              <div className="side-panel-note">{userCount} user(s) reported in this room.</div>
            </>
          )}

          {activeSidebar === "settings" && (
            <>
              <div className="side-panel-heading">SETTINGS</div>
              <label className="setting-label" htmlFor="sidebar-language">Editor language</label>
              <select id="sidebar-language" className="sidebar-select" value={language} onChange={(event) => setLanguage(event.target.value)}>
                {LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <label className="setting-label" htmlFor="sidebar-theme">Appearance</label>
              <select id="sidebar-theme" className="sidebar-select" value={theme} onChange={(event) => setTheme(event.target.value)}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </>
          )}
        </aside>

        <main className="editor-main">
          <div className="editor-tabbar">
            <div className="editor-tab">
              <span className="tab-language-icon">{language === "java" ? "J" : language === "python" ? "Py" : language === "javascript" ? "JS" : "C"}</span>
              <span>{language === "java" ? "Main.java" : language === "python" ? "main.py" : language === "javascript" ? "main.js" : language === "cpp" ? "main.cpp" : "main.c"}</span>
              <span className="tab-unsaved-dot" />
            </div>
            <div className="editor-tabbar-spacer" />
            <span className="tab-info">{LANGUAGES.find((item) => item.value === language)?.label}</span>
          </div>

          <div className="editor-toolbar">
            <div className="breadcrumbs">
              <span>COLLABCODE</span><span className="breadcrumb-separator">›</span>
              <span>{language === "java" ? "Main.java" : language === "python" ? "main.py" : language === "javascript" ? "main.js" : language === "cpp" ? "main.cpp" : "main.c"}</span>
            </div>
            <div className="toolbar-actions">
              <label className="language-picker-label" htmlFor="compiler-language">Compiler</label>
              <select
                id="compiler-language"
                className="language-select"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                aria-label="Select compiler language"
              >
                {LANGUAGES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <button className="run-button" onClick={runCode} disabled={running}>
                <span aria-hidden="true">{running ? "◌" : "▶"}</span>
                {running ? "Running..." : "Run Code"}
              </button>
            </div>
          </div>

          <div className="monaco-wrap">
            <Editor
              height="100%"
              language={language}
              theme={theme === "dark" ? "vs-dark" : "light"}
              value={code}
              onMount={handleEditorMount}
              onChange={handleEditorChange}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                minimap: { enabled: true, scale: 0.8 },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                wordWrap: "on",
                lineNumbers: "on",
                renderLineHighlight: "all",
                padding: { top: 16, bottom: 16 },
                smoothScrolling: true,
                cursorBlinking: "smooth",
                bracketPairColorization: { enabled: true },
                guides: { indentation: true, bracketPairs: true },
                tabSize: 4,
              }}
            />
          </div>

          <section className={`output-section ${outputOpen ? "output-expanded" : "output-collapsed"}`}>
            <div className="output-heading">
              <button className="output-heading-toggle" onClick={() => setOutputOpen((open) => !open)}>
                <span>{outputOpen ? "⌄" : "›"}</span>
                <span>TERMINAL</span>
              </button>
              <span className="output-status">{running ? "Running" : output ? "Finished" : "Ready"}</span>
              <div className="output-heading-spacer" />
              <button className="clear-output-button" onClick={() => setOutput("")} title="Clear output">Clear</button>
            </div>
            {outputOpen && (
              <pre className="output-content">{output || "Run your code to see the output here."}</pre>
            )}
          </section>

          <footer className="statusbar">
            <div className="statusbar-left">
              <span>⑂ main</span>
              <span>{connected ? "● Connected" : "○ Connecting..."}</span>
            </div>
            <div className="statusbar-right">
              <span>Ln {editorRef.current?.getPosition()?.lineNumber || 1}</span>
              <span>Spaces: 4</span>
              <span>UTF-8</span>
              <span>{LANGUAGES.find((item) => item.value === language)?.label}</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("collabcode-token"));
  const [showEditor, setShowEditor] = useState(
    () => new URLSearchParams(window.location.search).has("session")
  );

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

  const handleAuth = async (type, credentials) => {
    const response = await fetch(`${API_URL}/api/auth/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || data.error || "Authentication failed.");
    }

    if (type === "register") return data;

    if (!data.token) {
      throw new Error("Authentication token was not received from the server.");
    }

    localStorage.setItem("collabcode-token", data.token);
    const displayName = data.name || credentials.name || credentials.email || "Developer";
    localStorage.setItem("collabcode-name", displayName);
    setToken(data.token);
    setShowEditor(false);
    return data;
  };

  const openEditor = (roomId) => {
    const params = new URLSearchParams(window.location.search);
    params.set("session", roomId);
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
    setShowEditor(true);
  };

  const backToDashboard = () => {
    window.history.pushState({}, "", window.location.pathname);
    setShowEditor(false);
  };

  const logout = () => {
    localStorage.removeItem("collabcode-token");
    localStorage.removeItem("collabcode-name");
    window.history.pushState({}, "", window.location.pathname);
    setToken(null);
    setShowEditor(false);
  };

  useEffect(() => {
    const handlePopState = () => {
      setShowEditor(new URLSearchParams(window.location.search).has("session"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (!token) {
    return (
      <AuthPage
        onLogin={(credentials) => handleAuth("login", credentials)}
        onRegister={(credentials) => handleAuth("register", credentials)}
      />
    );
  }

  if (showEditor) return <CodeEditor onBack={backToDashboard} />;

  return (
    <Dashboard
      user={localStorage.getItem("collabcode-name") || "Developer"}
      onOpenEditor={openEditor}
      onLogout={logout}
    />
  );
}

export default App;
