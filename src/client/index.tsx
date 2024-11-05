import { createRoot } from "react-dom/client";
import { useState } from "react";
import { usePartySocket } from "partysocket/react";

function App() {
  const [text, setText] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const socket = usePartySocket({
    party: "my-agent",
    room: "some-room",
    onMessage(message) {
      const data = JSON.parse(message.data);
      setText(data.text);
    },
  });
  return (
    <div>
      {/* messages here */}
      <div>{text}</div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setText("loading...");
            socket.send(JSON.stringify({ type: "input", text: input }));
            setInput("");
          }
        }}
      />
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
