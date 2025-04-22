import { NextRequest, NextResponse } from "next/server";

// Dummy credentials for demonstration
const DEMO_USER = {
  username: "admin",
  password: "admin",
};

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (
    username === DEMO_USER.username &&
    password === DEMO_USER.password
  ) {
    // Set a cookie that can be read by JavaScript (for demo purposes)
    // In production, you should use HttpOnly cookies with a proper JWT token
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 1); // 1 day expiration

    return NextResponse.json({ success: true }, {
      status: 200,
      headers: {
        'Set-Cookie': `auth=1; Path=/; SameSite=Lax; Expires=${expirationDate.toUTCString()}`,
      },
    });
  }
  return NextResponse.json(
    { success: false, message: "Invalid username or password" },
    { status: 401 }
  );
}
