import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"

export function useSocket(room: string) {
  const socketRef = useRef<Socket | null>(null)
  useEffect(() => {
    const token = localStorage.getItem("token")
    const socket = io(import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000",
      { auth: { token } })
    socket.on("connect", () => socket.emit("join", room))
    socket.on("connect_error", () => {})
    socketRef.current = socket
    return () => { socket.disconnect() }
  }, [room])
  return socketRef
}
