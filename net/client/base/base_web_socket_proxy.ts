import {TsrpcError} from "tsrpc-proto"

export interface BaseWebSocketProxy {
    options: {
        onOpen: () => void
        onClose: (code: number, reason: string) => void
        onError: (e: unknown) => void
        onMessage: (data: Buffer) => void
    }

    connect(server: string, protocols?: string[]): void
    close(code?: number, reason?: string): void
    send(data: Uint8Array | string): Promise<{ err?: TsrpcError }>
}