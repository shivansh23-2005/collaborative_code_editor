
import { useEffect, useState } from "react";
import "./Dashboard.css";

const API_URL = "http://localhost:8080/api/rooms";

function Dashboard({ user, onOpenEditor, onLogout }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("collabcode-theme") || "dark"
  );

  const [activePage, setActivePage] = useState("Dashboard");
  const [roomType, setRoomType] = useState("Public");
  const [roomId, setRoomId] = useState("");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomError, setRoomError] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Resolve the current account email from the supplied user value.
  const userEmail =
    typeof user === "string"
      ? user.trim()
      : user?.email?.trim() || "";

  useEffect(() => {
    fetchRooms();
  }, [userEmail]);

  const fetchRooms = async () => {
    if (!userEmail) {
      setRooms([]);
      setRoomError(
        "Account email nahi mili. App.jsx se logged-in user ki email pass karo."
      );
      setLoadingRooms(false);
      return;
    }

    setLoadingRooms(true);

    try {
      setRoomError("");

      const response = await fetch(
        `${API_URL}?createdBy=${encodeURIComponent(userEmail)}`
      );

      if (!response.ok) {
        throw new Error("Unable to load rooms");
      }

      const data = await response.json();

      setRooms(
        data.map((room) => ({
          ...room,
          id: String(room.id ?? room.roomId),
          name: room.name,
          type: room.type,
          language: room.language || "Java",
          members: room.members ?? 1,
        }))
      );
    } catch (error) {
      setRoomError(
        "Rooms load nahi hue. Spring Boot backend aur MySQL connection check karo."
      );
    } finally {
      setLoadingRooms(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("collabcode-theme", newTheme);
  };

  const createRoom = async () => {
    if (creatingRoom) return;

    if (!userEmail) {
      alert("Account email nahi mili. Please dobara login karke check karo.");
      return;
    }

    setCreatingRoom(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${roomType} Coding Room`,
          type: roomType,
          language: "Java",
          createdBy: userEmail,
        }),
      });

      if (!response.ok) {
        throw new Error("Room creation failed");
      }

      const savedRoom = await response.json();

      const formattedRoom = {
        ...savedRoom,
        id: String(savedRoom.id ?? savedRoom.roomId),
        name: savedRoom.name,
        type: savedRoom.type,
        language: savedRoom.language || "Java",
        members: savedRoom.members ?? 1,
      };

      if (!formattedRoom.id || formattedRoom.id === "undefined") {
        throw new Error("Backend did not return a room ID");
      }

      setRooms((prev) => [
        ...prev.filter((room) => room.id !== formattedRoom.id),
        formattedRoom,
      ]);

      setShowCreateRoom(false);
      setActivePage("My Rooms");
    } catch (error) {
      alert(
        "Room create nahi hua. Backend API aur database configuration check karo."
      );
    } finally {
      setCreatingRoom(false);
    }
  };

  const deleteRoom = async (id) => {
    const room = rooms.find((item) => item.id === id);

    if (!room) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${room.name}"?`
    );

    if (!confirmed) return;

    if (!userEmail) {
      alert("Account email nahi mili.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(id)}?createdBy=${encodeURIComponent(userEmail)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Room deletion failed");
      }

      setRooms((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      alert(
        "Room delete nahi hua. Check karo ki room tumhare account ka hai aur backend updated hai."
      );
    }
  };

  const joinRoom = async (id) => {
    const enteredId = String(id || "").trim();

    if (!enteredId) {
      alert("Please enter a Room ID.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(enteredId)}`
      );

      if (response.status === 404) {
        alert("Room not found. Please check the Room ID.");
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to join room");
      }

      const room = await response.json();
      const verifiedId = room.id ?? room.roomId;

      if (!verifiedId) {
        throw new Error("Invalid room response");
      }

      onOpenEditor(String(verifiedId));
    } catch (error) {
      alert("Room join nahi hua. Backend connection check karo.");
    }
  };

  const renderRoomCard = (room, buttonText = "Join →") => (
    <div className="room-card" key={room.id}>
      <div className="room-card-top">
        <span className="room-language">
          {room.language || "Java"}
        </span>

        <span
          className={`room-badge ${(room.type || "Public").toLowerCase()}`}
        >
          {room.type || "Public"}
        </span>
      </div>

      <h3>{room.name}</h3>

      <p className="room-id">Room ID: {room.id}</p>

      <div className="room-card-bottom">
        <span>👥 {room.members ?? 1} members</span>

        <div className="room-actions">
          <button onClick={() => joinRoom(room.id)}>
            {buttonText}
          </button>

          <button
            className="delete-room-button"
            onClick={() => deleteRoom(room.id)}
            title={`Delete ${room.name}`}
          >
            🗑 Delete
          </button>
        </div>
      </div>
    </div>
  );

  const visibleRooms =
    activePage === "My Rooms"
      ? rooms
      : rooms.filter((room) => room.type === roomType);

  const pages = [
    { name: "Dashboard", icon: "⌂" },
    { name: "Rooms", icon: "▦" },
    { name: "My Rooms", icon: "▣" },
    { name: "Profile", icon: "♙" },
  ];

  const publicRoomCount = rooms.filter(
    (room) => room.type === "Public"
  ).length;

  const privateRoomCount = rooms.filter(
    (room) => room.type === "Private"
  ).length;

  return (
    <div className={`dashboard theme-${theme}`}>
      <aside className="sidebar">
        <div className="dashboard-logo">
          <span className="logo-icon">⚡</span>
          <span>CollabCode</span>
        </div>

        <div className="sidebar-heading">WORKSPACE</div>

        <nav className="sidebar-nav">
          {pages.map((page) => (
            <button
              key={page.name}
              className={`nav-item ${
                activePage === page.name ? "active" : ""
              }`}
              onClick={() => setActivePage(page.name)}
            >
              <span className="nav-icon">{page.icon}</span>
              <span>{page.name}</span>

              {activePage === page.name && (
                <span className="nav-indicator" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar">
              {(userEmail || "U").charAt(0).toUpperCase()}
            </div>

            <div className="user-details">
              <strong>{userEmail || "Developer"}</strong>
              <span>Developer</span>
            </div>
          </div>

          <button className="logout-button" onClick={onLogout}>
            ↪ Logout
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb-container">
            <span className="breadcrumb">Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${
                theme === "dark" ? "light" : "dark"
              } mode`}
              title={`Switch to ${
                theme === "dark" ? "light" : "dark"
              } mode`}
            >
              <span className="theme-toggle-icon">
                {theme === "dark" ? "☀️" : "🌙"}
              </span>
            </button>

            <button
              className="topbar-create"
              onClick={() => {
                setRoomId("");
                setActivePage("Join Room");
              }}
            >
              👥 Join Room
            </button>

            <button
              className="topbar-create"
              onClick={() => setShowCreateRoom(true)}
            >
              + Create Room
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {loadingRooms && <p>Loading rooms...</p>}

          {roomError && <p role="alert">{roomError}</p>}

          {activePage === "Dashboard" && (
            <>
              <section className="welcome-section">
                <div className="welcome-content">
                  <p className="eyebrow">
                    <span className="eyebrow-dot" />
                    YOUR CODING WORKSPACE
                  </p>

                  <h1>
                    Welcome back, <span>{userEmail || "Developer"}!</span>
                  </h1>

                  <p className="welcome-description">
                    Code together, solve problems, and build something
                    great.
                  </p>

                  <button
                    className="welcome-button"
                    onClick={() => onOpenEditor("ABC123")}
                  >
                    {"</>"} Open Code Editor →
                  </button>
                </div>

                <div className="welcome-art">
                  <div className="art-orbit art-orbit-one" />
                  <div className="art-orbit art-orbit-two" />
                  <div className="art-glow" />
                  <div className="welcome-icon">{"</>"}</div>
                  <div className="floating-symbol symbol-one">{"{ }"}</div>
                  <div className="floating-symbol symbol-two">{"< />"}</div>
                  <div className="floating-symbol symbol-three">⚡</div>
                </div>
              </section>

              <section className="stats-grid">
                <div className="stat-card stat-purple">
                  <div className="stat-top">
                    <span className="stat-label">Total Rooms</span>
                    <span className="stat-icon">▦</span>
                  </div>
                  <h2>{rooms.length}</h2>
                  <div className="stat-accent" />
                </div>

                <div className="stat-card stat-blue">
                  <div className="stat-top">
                    <span className="stat-label">Public Rooms</span>
                    <span className="stat-icon">🌐</span>
                  </div>
                  <h2>{publicRoomCount}</h2>
                  <small>Open coding sessions</small>
                  <div className="stat-accent" />
                </div>

                <div className="stat-card stat-pink">
                  <div className="stat-top">
                    <span className="stat-label">Private Rooms</span>
                    <span className="stat-icon">🔒</span>
                  </div>
                  <h2>{privateRoomCount}</h2>
                  <small>Private workspaces</small>
                  <div className="stat-accent" />
                </div>
              </section>

              <section className="recent-rooms">
                <div className="section-heading">
                  <div>
                    <p className="section-eyebrow">WORKSPACE</p>
                    <h2>Your Rooms</h2>
                  </div>

                  <button
                    className="topbar-create"
                    onClick={() => setActivePage("My Rooms")}
                  >
                    View All →
                  </button>
                </div>

                <div className="room-grid">
                  {!loadingRooms && rooms.length > 0 ? (
                    rooms.slice(0, 3).map((room) =>
                      renderRoomCard(room)
                    )
                  ) : !loadingRooms && !roomError ? (
                    <div className="empty-rooms">
                      <h3>No Rooms Yet</h3>
                      <p>Create a new room to get started.</p>
                      <button
                        className="topbar-create"
                        onClick={() => setShowCreateRoom(true)}
                      >
                        + Create Room
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          )}

          {activePage === "Rooms" && (
            <>
              <section className="page-heading">
                <p className="section-eyebrow">COLLABORATE</p>
                <h1>Explore Rooms</h1>
                <p>Find a coding room and start collaborating.</p>
              </section>

              <div className="room-tabs">
                <button
                  className={roomType === "Public" ? "selected" : ""}
                  onClick={() => setRoomType("Public")}
                >
                  🌐 Public Rooms
                </button>

                <button
                  className={roomType === "Private" ? "selected" : ""}
                  onClick={() => setRoomType("Private")}
                >
                  🔒 Private Rooms
                </button>
              </div>

              {roomType === "Private" && (
                <div className="join-private">
                  <h3>Join a Private Room</h3>
                  <p>Enter the Room ID provided by the room owner.</p>

                  <div className="join-form">
                    <input
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder="Enter Room ID"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") joinRoom(roomId);
                      }}
                    />

                    <button onClick={() => joinRoom(roomId)}>
                      Join Room
                    </button>
                  </div>
                </div>
              )}

              <div className="room-grid">
                {!loadingRooms && visibleRooms.length > 0 ? (
                  visibleRooms.map((room) => renderRoomCard(room))
                ) : !loadingRooms && !roomError ? (
                  <div className="empty-rooms">
                    <h3>No {roomType} Rooms Found</h3>
                    <p>Create a room to start collaborating.</p>
                    <button
                      className="topbar-create"
                      onClick={() => setShowCreateRoom(true)}
                    >
                      + Create Room
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {activePage === "Join Room" && (
            <>
              <section className="page-heading">
                <p className="section-eyebrow">COLLABORATE</p>
                <h1>Join a Room</h1>
                <p>
                  Enter a Room ID to join your friends in the same coding
                  workspace.
                </p>
              </section>

              <div className="join-private">
                <h3>Join Existing Room</h3>
                <p>Ask the room owner for the Room ID.</p>

                <div className="join-form">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Enter Room ID"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") joinRoom(roomId);
                    }}
                  />

                  <button onClick={() => joinRoom(roomId)}>
                    Join Room →
                  </button>
                </div>
              </div>
            </>
          )}

          {activePage === "My Rooms" && (
            <>
              <section className="page-heading">
                <p className="section-eyebrow">YOUR WORKSPACE</p>
                <h1>My Rooms</h1>
                <p>Manage your coding workspaces.</p>
              </section>

              <div className="room-grid">
                {!loadingRooms && rooms.length > 0 ? (
                  rooms.map((room) => renderRoomCard(room, "Open →"))
                ) : !loadingRooms && !roomError ? (
                  <div className="empty-rooms">
                    <h3>No Rooms Yet</h3>
                    <p>Create a new room to start coding.</p>
                    <button
                      className="topbar-create"
                      onClick={() => setShowCreateRoom(true)}
                    >
                      + Create Room
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {activePage === "Profile" && (
            <section className="profile-card">
              <div className="profile-avatar">
                {(userEmail || "U").charAt(0).toUpperCase()}
              </div>

              <h1>{userEmail || "Developer"}</h1>
              <p>CollabCode Developer</p>

              <div className="profile-info">
                <div>
                  <span>Workspace</span>
                  <strong>CollabCode</strong>
                </div>

                <div>
                  <span>Total Rooms</span>
                  <strong>{rooms.length}</strong>
                </div>
              </div>

              <button className="profile-logout" onClick={onLogout}>
                Logout
              </button>
            </section>
          )}
        </div>

        {showCreateRoom && (
          <div
            className="modal-overlay"
            onClick={() => setShowCreateRoom(false)}
          >
            <div
              className="create-room-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setShowCreateRoom(false)}
                aria-label="Close modal"
              >
                ×
              </button>

              <div className="modal-icon">＋</div>
              <p className="section-eyebrow">NEW WORKSPACE</p>
              <h2>Create a Room</h2>
              <p>Choose the type of coding room you want.</p>

              <label htmlFor="room-type">Room Type</label>

              <select
                id="room-type"
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
              >
                <option value="Public">Public Room</option>
                <option value="Private">Private Room</option>
              </select>

              <button
                className="create-room-submit"
                onClick={createRoom}
                disabled={creatingRoom}
              >
                {creatingRoom
                  ? "Creating..."
                  : `Create ${roomType} Room`}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
