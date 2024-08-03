import net from "net";

// MacSploit API JS V1.0

const ipc_execute = 0;
const ipc_setting = 1;
const ipc_ping = 2;

const ms_port = 5553; // 5553 ~ 5563 for each roblox window
const ms_host = "127.0.0.1";
let socket = null;

function attach_macsploit() {
    socket = net.createConnection(ms_port, ms_host);

    socket.on("connect", () => {
        console.log("Connected!");
        const test_script = "print('Hello World!')";
    
        socket.write(script_payload(test_script));
        socket.write(setting_payload("robloxRpc", "false"));
        socket.write(ping_payload());
        console.log("Completed Test!");
    });

    socket.on("data", (data) => {
        if (data.at(0) == 0x10) {
            console.log("Pong!");
        }
    });

    socket.on("timeout", console.error);
    socket.on("error", console.error);
}

function build_header(type, payload_len) {
    payload_len = payload_len ? payload_len : 0;
    const data = Buffer.alloc(16 + payload_len); // uint8_t, int
    data.writeUInt8(type, 0);
    data.writeInt32LE(payload_len, 8);
    return [data, 16];
}

function script_payload(script) {
    const [data, offset] = build_header(ipc_execute, script.length + 1);
    data.write(script, offset);
    return data;
}

function setting_payload(key, value) {
    const payload = `${key} ${value}`;
    const [data, offset] = build_header(ipc_setting, payload.length + 1);
    data.write(payload, offset);
    return data;
}

function ping_payload() {
    const [data] = build_header(ipc_ping);
    return data;
}

attach_macsploit();
console.log("Ready.");