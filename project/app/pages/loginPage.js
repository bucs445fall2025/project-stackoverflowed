// pages/loginPage.js
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import StarsBackground from "../components/StarsBackground";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const popupRef = useRef(null);

  // Draggable logic
  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      offsetX = e.clientX - popup.offsetLeft;
      offsetY = e.clientY - popup.offsetTop;
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      popup.style.left = `${e.clientX - offsetX}px`;
      popup.style.top = `${e.clientY - offsetY}px`;
    };

    const onMouseUp = () => { isDragging = false; };

    popup.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      popup.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [error]);

  // Auto-dismiss
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(false);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) router.push("/dashboard");
      else setError(true);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  };

  return (
    <StarsBackground>
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
        position: "relative",
      }}>
        {/* Login Box */}
        <div style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(10px)",
          padding: "40px",
          borderRadius: "15px",
          boxShadow: "0 0 30px rgba(0,0,0,0.5)",
          width: "350px",
          textAlign: "center",
          color: "white",
        }}>
          <h2 style={{ marginBottom: "20px" }}>Login</h2>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 15px",
                margin: "10px 0",
                border: "none",
                borderRadius: "10px",
                outline: "none",
                fontSize: "16px",
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 15px",
                margin: "10px 0",
                border: "none",
                borderRadius: "10px",
                outline: "none",
                fontSize: "16px",
              }}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "10px",
                border: "none",
                borderRadius: "10px",
                background: "linear-gradient(90deg, #8a2be2, #4b0082)",
                color: "white",
                fontSize: "18px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 5px 15px rgba(0,0,0,0.3)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Login
            </button>
          </form>
        </div>

        {/* Error Popup */}
        {error && (
          <div
            ref={popupRef}
            style={{
              position: "absolute",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "20px",
              background: "rgba(255,0,0,0.85)",
              borderRadius: "15px",
              textAlign: "center",
              color: "white",
              animation: "fadeIn 0.3s ease-in-out",
              maxWidth: "300px",
              cursor: "move",
              zIndex: 1000
            }}
          >
            <p>Login failed! You may not have an account.</p>
            <button
              onClick={() => router.push("/signUpPage")}
              style={{
                marginTop: "10px",
                padding: "10px 20px",
                border: "none",
                borderRadius: "10px",
                background: "linear-gradient(90deg, #ff416c, #ff4b2b)",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              Click here to sign up
            </button>
          </div>
        )}

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </StarsBackground>
  );
}
