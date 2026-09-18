import { ChatGateway } from './chat.gateway';

describe('ChatGateway — message acknowledgements', () => {
    let chatService: any;
    let authService: any;
    let gateway: ChatGateway;
    let emit: jest.Mock;
    let to: jest.Mock;
    let client: any;

    beforeEach(() => {
        chatService = {
            sendMessage: jest.fn(),
        };
        authService = {};
        gateway = new ChatGateway(chatService, authService);

        emit = jest.fn();
        to = jest.fn().mockReturnValue({ emit });
        (gateway as any).server = { to };

        client = {
            data: { userId: '11111111-1111-4111-8111-111111111111' },
        };
    });

    it('acknowledges a newly persisted message and broadcasts it once', async () => {
        const message = {
            id: 'message-1',
            chatRoomId: '22222222-2222-4222-8222-222222222222',
            senderId: client.data.userId,
            clientMessageId: '33333333-3333-4333-8333-333333333333',
            content: 'Hello',
        };
        chatService.sendMessage.mockResolvedValue({
            message,
            created: true,
        });

        const result = await gateway.handleMessage(client, {
            roomId: message.chatRoomId,
            content: message.content,
            clientMessageId: message.clientMessageId,
        });

        expect(result).toEqual({
            ok: true,
            message,
            duplicate: false,
        });
        expect(to).toHaveBeenCalledWith(`room:${message.chatRoomId}`);
        expect(emit).toHaveBeenCalledWith('message:new', message);
    });

    it('acknowledges an idempotent retry without rebroadcasting it', async () => {
        const message = {
            id: 'message-1',
            chatRoomId: '22222222-2222-4222-8222-222222222222',
            senderId: client.data.userId,
            clientMessageId: '33333333-3333-4333-8333-333333333333',
            content: 'Hello',
        };
        chatService.sendMessage.mockResolvedValue({
            message,
            created: false,
        });

        const result = await gateway.handleMessage(client, {
            roomId: message.chatRoomId,
            content: message.content,
            clientMessageId: message.clientMessageId,
        });

        expect(result).toEqual({
            ok: true,
            message,
            duplicate: true,
        });
        expect(to).not.toHaveBeenCalled();
        expect(emit).not.toHaveBeenCalled();
    });

    it('returns a structured negative acknowledgement on send failure', async () => {
        chatService.sendMessage.mockRejectedValue(
            Object.assign(new Error('Room is read-only'), { code: 'READ_ONLY' }),
        );

        const result = await gateway.handleMessage(client, {
            roomId: '22222222-2222-4222-8222-222222222222',
            content: 'Hello',
            clientMessageId: '33333333-3333-4333-8333-333333333333',
        });

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'READ_ONLY',
                message: 'Room is read-only',
            },
        });
        expect(to).not.toHaveBeenCalled();
    });
});
