import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import AuthPage from "./AuthPage.jsx";
import Dashboard from "./Dashboard.jsx";
import "./App.css";

// ==========================================
// CODE EDITOR
// ==========================================

function CodeEditor() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("collabcode-theme") || "dark"
  );

  useEffect(() => {
    localStorage.setItem("collabcode-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

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

  // ==========================================
  // WEBSOCKET CONNECTION
  // ==========================================

  useEffect(() => {
    const WS_URL =
      import.meta.env.VITE_WS_URL || "ws://localhost:8080";

    const ws = new WebSocket(`${WS_URL}/ws`);

    socket.current = ws;

    ws.onopen = () => {
      console.log("WEBSOCKET CONNECTED");
      setConnected(true);

      ws.send(
        JSON.stringify({
          type: "join",
          sessionId: sessionId,
        })
      );
    };

    ws.onmessage = (event) => {
      console.log("SERVER MESSAGE:", event.data);

      try {
        const data = JSON.parse(event.data);

        if (data.type === "code") {
          applyingRemote.current = true;
          setCode(data.code);

          if (editorRef.current) {
            const model = editorRef.current.getModel();

            if (model && model.getValue() !== data.code) {
              model.setValue(data.code);
            }
          }

          if (typeof data.version === "number") {
            versionRef.current = data.version;
          }

          setTimeout(() => {
            applyingRemote.current = false;
          }, 50);

          return;
        }

        if (data.type === "version") {
          versionRef.current = data.version;
          console.log("VERSION:", data.version);
          return;
        }

        if (data.type === "users") {
          setUserCount(data.count);
          return;
        }

        if (data.type === "operation") {
          applyRemoteOperation(data);
          return;
        }
      } catch (error) {
        console.error("MESSAGE ERROR:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WEBSOCKET ERROR:", error);
    };

    ws.onclose = () => {
      console.log("WEBSOCKET DISCONNECTED");
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  // ==========================================
  // APPLY REMOTE OPERATION
  // ==========================================

  const applyRemoteOperation = (operation) => {
    const editor = editorRef.current;

    if (!editor) return;

    const model = editor.getModel();

    if (!model) return;

    applyingRemote.current = true;

    const position = Math.max(
      0,
      Math.min(operation.position, model.getValueLength())
    );

    const deleteCount = Math.max(
      0,
      Math.min(
        operation.deleteCount || 0,
        model.getValueLength() - position
      )
    );

    const range = model.getPositionAt(position);
    const end = model.getPositionAt(position + deleteCount);

    editor.executeEdits("remote-operation", [
      {
        range: {
          startLineNumber: range.lineNumber,
          startColumn: range.column,
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

    setTimeout(() => {
      applyingRemote.current = false;
    }, 50);
  };

  // ==========================================
  // EDITOR MOUNT
  // ==========================================

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
      monaco.KeyMod.CtrlCmd |
        monaco.KeyMod.Shift |
        monaco.KeyCode.KeyZ,
      () => sendHistoryAction("redo")
    );

    console.log("MONACO READY");
  };

  // ==========================================
  // SEND UNDO / REDO
  // ==========================================

  const sendHistoryAction = (action) => {
    if (
      !socket.current ||
      socket.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    socket.current.send(
      JSON.stringify({
        type: action,
      })
    );

    console.log("SENT:", action);
  };

  // ==========================================
  // LOCAL EDIT
  // ==========================================

  const handleEditorChange = (value, event) => {
    const newCode = value || "";

    setCode(newCode);

    if (applyingRemote.current) return;

    if (
      !socket.current ||
      socket.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    if (!event || !event.changes || event.changes.length === 0) {
      return;
    }

    const changes = [...event.changes].sort(
      (a, b) => b.rangeOffset - a.rangeOffset
    );

    for (const change of changes) {
      const baseVersion = versionRef.current;

      const operation = {
        type: "operation",
        sessionId: sessionId,
        position: change.rangeOffset,
        deleteCount: change.rangeLength,
        text: change.text || "",
        baseVersion: baseVersion,
      };

      socket.current.send(JSON.stringify(operation));

      versionRef.current = baseVersion + 1;
    }
  };

  // ==========================================
  // RUN CODE
  // ==========================================

  const runCode = async () => {
    setRunning(true);
    setOutput("Running...");

    try {
      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:8080";

      const response = await fetch(`${API_URL}/api/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setOutput(
          data.output || "Program executed successfully."
        );
      } else {
        setOutput(data.error || "Execution failed.");
      }
    } catch (error) {
      console.error("CODE EXECUTION ERROR:", error);
      setOutput("Could not connect to execution server.");
    } finally {
      setRunning(false);
    }
  };

  // ==========================================
  // EDITOR UI
  // ==========================================

  return (
    <div className={`app ${theme}-mode`}>
      <header className="header">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={
            theme === "dark"
              ? "Switch to Light Mode"
              : "Switch to Dark Mode"
          }
          aria-label="Toggle color theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        <div className="logo">⚡ CollabCode</div>

        <div className="session">
          Session:
          <span>{sessionId}</span>
        </div>

        <div className="users">
          {connected ? "🟢" : "🔴"} {userCount} Users
        </div>

        <button
          className="share-button"
          onClick={() => {
            navigator.clipboard
              .writeText(window.location.href)
              .then(() => alert("Session link copied!"))
              .catch(() =>
                alert("Could not copy the session link.")
              );
          }}
        >
          🔗 Share
        </button>
      </header>

      <div className="toolbar">
        <button
          className="run-button"
          onClick={runCode}
          disabled={running}
        >
          {running ? "⏳ Running..." : "▶ Run Code"}
        </button>
      </div>

      <main className="editor-container">
        <Editor
          height="100%"
          language="java"
          theme={theme === "dark" ? "vs-dark" : "light"}
          value={code}
          onMount={handleEditorMount}
          onChange={handleEditorChange}
          options={{
            fontSize: 16,
            minimap: {
              enabled: false,
            },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            undoRedo: true,
          }}
        />
      </main>

      <div className="output-panel">
        <div className="output-header">Output</div>
        <pre>
          {output || "Run your code to see the output here."}
        </pre>
      </div>
    </div>
  );
}

// ==========================================
// LOGIN, DASHBOARD AND REGISTRATION
// ==========================================

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("collabcode-token")
  );

  const [showEditor, setShowEditor] = useState(
    () => new URLSearchParams(window.location.search).has("session")
  );

  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:8080";

  // ==========================================
  // LOGIN / REGISTER API
  // ==========================================

  const handleAuth = async (type, credentials) => {
    const response = await fetch(
      `${API_URL}/api/auth/${type}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || data.error || "Authentication failed."
      );
    }

    // Registration ke baad token expect nahi karna
    if (type === "register") {
      return data;
    }

    // Login ke baad token check karna
    if (!data.token) {
      throw new Error(
        "Authentication token was not received from the server."
      );
    }

    localStorage.setItem("collabcode-token", data.token);

    const displayName =
      data.name ||
      credentials.name ||
      credentials.email ||
      "Developer";

    localStorage.setItem("collabcode-name", displayName);

    setToken(data.token);
    setShowEditor(false);

    return data;
  };

  // ==========================================
  // OPEN EDITOR FROM DASHBOARD
  // ==========================================

  const openEditor = (roomId) => {
    const params = new URLSearchParams(
      window.location.search
    );

    params.set("session", roomId);

    window.history.pushState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`
    );

    setShowEditor(true);
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = () => {
    localStorage.removeItem("collabcode-token");
    localStorage.removeItem("collabcode-name");

    window.history.pushState(
      {},
      "",
      window.location.pathname
    );

    setToken(null);
    setShowEditor(false);
  };

  // ==========================================
  // SHOW LOGIN / REGISTER PAGE
  // ==========================================

  if (!token) {
    return (
      <AuthPage
        onLogin={(credentials) =>
          handleAuth("login", credentials)
        }
        onRegister={(credentials) =>
          handleAuth("register", credentials)
        }
      />
    );
  }

  // ==========================================
  // SHOW EDITOR
  // ==========================================

  if (showEditor) {
    return <CodeEditor />;
  }

  // ==========================================
  // SHOW DASHBOARD AFTER LOGIN
  // ==========================================

  return (
    <Dashboard
      user={
        localStorage.getItem("collabcode-name") ||
        "Developer"
      }
      onOpenEditor={openEditor}
      onLogout={logout}
    />
  );
}
export default App;
