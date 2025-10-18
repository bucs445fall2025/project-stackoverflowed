import { useState } from "react";
import { useRouter } from "next/router"; // ✅ use Next.js router

export default function Signup() {
  const router = useRouter(); // ✅ initialize router

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      const response = await fetch("https://feisty-renewal-production.up.railway.app/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Account created! Redirecting...");
        setTimeout(() => router.push("/link-amazon"), 1500); // ✅ Next.js routing
      } else {
        setMessage(data.message || "Something went wrong.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Server error. Try again later.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-8">
        <h2 className="text-2xl font-semibold text-center mb-6">Create FBAlgo Account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* inputs */}
          <input
            type="text"
            name="username"
            placeholder="Username"
            required
            value={formData.username}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-300"
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-300"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            value={formData.password}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-300"
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            required
            value={formData.confirmPassword}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-300"
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition duration-200"
          >
            Sign Up
          </button>
        </form>
        {message && <p className="text-center mt-4 text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
}

/*
    ACCOUNT CREATION FLOW:

	1.	Landing page → Sign-up page
        •	From index.js (landing page), user clicks “Sign Up” → navigates to /signup.
        •	Sign-up form fields:
        •	username
        •	email (optional but useful)
        •	password
        •	confirm password
        
    2.	Submit account info
	    •	On form submit → send POST request to backend route like /api/users/register
	    •	Body example:
                {
                "username": "jackson",
                "email": "jackson@email.com",
                "password": "mypassword"
                }

    3.	Backend validation & DB insert
        •	Backend checks if username/email already exists.
        •	Password is hashed (e.g., bcrypt).
        •	New user entry added to DB:
                {
                user_id: 1,
                username: "jackson",
                email: "jackson@email.com",
                password_hash: "hashed_password",
                amazon_refresh_token: null,
                amazon_access_token: null,
                amazon_token_expiry: null
                }

    4.	Frontend success → Link Amazon page
        •	After successful signup, user is redirected to /link-amazon.
        •	UI shows a “Link Amazon Account” button.

	5.	Amazon linking
        •	Clicking the button triggers the Login with Amazon (LWA) OAuth flow.
        •	Amazon redirects to your redirect URI with an authorization code.
        •	Backend exchanges the code for tokens (access + refresh).
        •	Those tokens are stored in the same user record in the database.

	6.	Redirect to Dashboard
        •	Once Amazon linking is complete, redirect user to /dashboard.
        •	Dashboard now loads their account info (both FBAlgo + Amazon data).
*/