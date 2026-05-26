const { requireSocketAuth } = require('../../middlewares/socket.middleware');
const { buildSocketPayload, emitSocketEvent } = require('../../utils/socket.util');
const repository = require('./visit.repository');

const CROWD_NAMESPACE = '/ws/crowd';
const CROWD_UPDATE_EVENT = 'crowd_update';

let crowdNamespace;
let crowdBroadcastInterval;

const getCrowdMeter = async () => {
    const count = await repository.getCrowdCount();

    return {
        count,
        status: count > 20 ? 'Busy' : count > 10 ? 'Moderate' : 'Quiet'
    };
};

const buildCrowdEmitPayload = ({ event, data, emittedFrom }) => {
    return buildSocketPayload({
        namespace: CROWD_NAMESPACE,
        event,
        data,
        emittedFrom
    });
};

const emitCrowdUpdate = ({ count, status, emittedFrom = 'unknown' }) => {
    const payload = emitSocketEvent({
        namespaceInstance: crowdNamespace,
        namespace: CROWD_NAMESPACE,
        event: CROWD_UPDATE_EVENT,
        data: { count, status },
        emittedFrom
    });

    return payload;
};

const emitCrowdUpdateToSocket = ({ socket, count, status, emittedFrom = 'unknown' }) => {
    const payload = buildCrowdEmitPayload({
        event: CROWD_UPDATE_EVENT,
        data: { count, status },
        emittedFrom
    });

    socket.emit(CROWD_UPDATE_EVENT, payload);
    return payload;
};

const emitLatestCrowdToSocket = async (socket, emittedFrom) => {
    const crowdMeter = await getCrowdMeter();

    return emitCrowdUpdateToSocket({
        socket,
        count: crowdMeter.count,
        status: crowdMeter.status,
        emittedFrom
    });
};

const startCrowdAutoBroadcast = () => {
    if (crowdBroadcastInterval) {
        return;
    }

    crowdBroadcastInterval = setInterval(async () => {
        try {
            const crowdMeter = await getCrowdMeter();

            emitCrowdUpdate({
                count: crowdMeter.count,
                status: crowdMeter.status,
                emittedFrom: 'crowd.socket.autoBroadcast'
            });
        } catch (err) {
            console.error('Failed to emit automatic crowd update:', err.message);
        }
    }, 60 * 1000);
};

const initCrowdSocket = (io) => {
    crowdNamespace = io.of(CROWD_NAMESPACE);

    crowdNamespace.use(requireSocketAuth);

    crowdNamespace.on('connection', async (socket) => {
        try {
            await emitLatestCrowdToSocket(socket, 'crowd.socket.onConnection');
        } catch (err) {
            console.error('Failed to emit initial crowd update:', err.message);
        }
    });

    startCrowdAutoBroadcast();
};

initCrowdSocket.buildCrowdEmitPayload = buildCrowdEmitPayload;
initCrowdSocket.emitCrowdUpdate = emitCrowdUpdate;
initCrowdSocket.emitCrowdUpdateToSocket = emitCrowdUpdateToSocket;
initCrowdSocket.startCrowdAutoBroadcast = startCrowdAutoBroadcast;

module.exports = initCrowdSocket;