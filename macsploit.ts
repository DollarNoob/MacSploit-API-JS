import { EventEmitter } from "events";
import net from "net";

// MacSploit API TS V1.1

export enum IpcTypes {
    IPC_EXECUTE,
    IPC_SETTING
}

export enum MessageTypes {
    PRINT = 1,
    ERROR = 2
}

interface ClientEvents {
    message: (name: string, type: (typeof MessageTypes)[keyof typeof MessageTypes]) => any;
    error: (err: Error) => any;
    close: (err?: Error) => any;
}

export class Client extends EventEmitter {
    private _host = "127.0.0.1"; // localhost
    private _port: number = 5553; // 5553 ~ 5562 for each roblox window (max 10)
    private _socket: net.Socket | null = null;

    constructor() {
        super();
    }

    on<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): this {
        return super.on(event, listener);
    }

    get socket() {
        return this._socket;
    }

    isAttached() {
        return this._socket ? this._socket.readyState === "open" : false;
    }

    attach(port: number) {
        return new Promise<void>((resolve, reject) => {
            if (this._socket) return reject(new Error("AlreadyInjectedError: Socket is already connected."));

            this._port = port;
            this._socket = net.createConnection(port, this._host);

            let connected = false;
            this._socket.once("connect", () => {
                connected = true;
                resolve();
            });

            this._socket.on("data", (data) => {
                const type = data.at(0);
                if (!type || !(type in MessageTypes)) return; // unknown type

                const length = data.subarray(8, 16).readBigUInt64LE(); // length of output
                const message = data.subarray(16, 16 + Number(length)).toString("utf-8");

                this.emit("message", message, type);
            });

            let lastError: Error | null = null;
            this._socket.on("timeout", console.error);
            this._socket.on("error", (err) => {
                lastError = err;
                if (this.listenerCount("error") > 0) {
                    this.emit("error", err);
                }
            });
            this._socket.once("close", (hadError) => {
                if (connected) {
                    if (hadError) this.emit("close", lastError);
                    else this.emit("close");
                } else if (hadError) {
                    if (lastError!.message.includes("connect ECONNREFUSED")) {
                        reject(new Error("ConnectionRefusedError: Socket is not open."));
                    } else {
                        reject(new Error("ConnectionError: Socket closed due to an error."));
                    }
                } else {
                    reject();
                }
                this._socket = null; // let the gc do its work
            });
        });
    }

    reattach() {
        return this.attach(this._port);
    }

    detach() {
        return new Promise<void>((resolve, reject) => {
            if (!this._socket) return reject(new Error("NotInjectedError: Socket is already closed."));

            this._socket.once("close", (hadError) => {
                if (hadError) return reject(new Error("ConnectionError: Socket closed due to an error."));
                resolve();
                this._socket = null; // let the gc do its work
            });
            this._socket.destroy();
        });
    }

    private _buildHeader(type: IpcTypes, length = 0) {
        const data = Buffer.alloc(16 + length + 1); // uint8_t, int
        data.writeUInt8(type, 0);
        data.writeInt32LE(length, 8);
        return data;
    }

    executeScript(script: string) {
        if (!this._socket) throw new Error("NotInjectedError: Please attach before executing scripts.");

        const encoded = new TextEncoder().encode(script);
        const data = this._buildHeader(IpcTypes.IPC_EXECUTE, encoded.length);
        data.write(script, 16); // data + offset

        return this._socket.write(data); // usually returns true
    }

    updateSetting(key: string, value: boolean) {
        if (!this._socket) throw new Error("NotInjectedError: Please attach before executing scripts.");

        const payload = `${key} ${value ? "true" : "false"}`;
        const data = this._buildHeader(IpcTypes.IPC_SETTING, payload.length);
        data.write(payload, 16); // data + offset

        return this._socket.write(data); // usually returns true
    }
}
