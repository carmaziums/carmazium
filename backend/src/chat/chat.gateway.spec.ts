import { ChatGateway } from './chat.gateway';

describe('ChatGateway — message acknowledgements', () => {
    let chatService: any;
    let authService: any;
    let gateway: ChatGateway;
    let chatRateLimit: any;
    let emit: jest.Mock;
    let to: jest.Mock;
    let client: any;

    beforeEach(() => {
        chatService = {
            sendMessage: jest.fn(),
        };
        authService = {};
        chatRateLimit = {
            consumeMessage: jest.fn().mockResolvedValue(undefined),
            consumeTyping: jest.fn().mockResolvedValue(undefined),
        };
        gateway = new ChatGateway(chatService, authService, chatRateLimit);

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
        expect(chatRateLimit.consumeMessage).toHaveBeenCalledWith(client.data.userId);
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

    it('uses distributed user rooms for cross-instance room membership updates', () => {
        const socketsJoin = jest.fn();
        const socketsLeave = jest.fn();
        const inMock = jest.fn().mockReturnValue({ socketsJoin, socketsLeave });
        (gateway as any).server = {
            in: inMock,
            to,
        };

        gateway.joinRoomForUser('user-2', 'room-2');
        gateway.leaveRoomForUser('user-2', 'room-2');

        expect(inMock).toHaveBeenCalledWith('user:user-2');
        expect(socketsJoin).toHaveBeenCalledWith('room:room-2');
        expect(socketsLeave).toHaveBeenCalledWith('room:room-2');
    });

    it('emits personalised room updates through the distributed user room', () => {
        const userEmit = jest.fn();
        const toMock = jest.fn().mockReturnValue({ emit: userEmit });
        (gateway as any).server = { to: toMock };

        const room = { id: 'room-3', chatBlocked: true };
        gateway.emitRoomUpdatedToUser('user-3', room);

        expect(toMock).toHaveBeenCalledWith('user:user-3');
        expect(userEmit).toHaveBeenCalledWith('room:updated', room);
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
