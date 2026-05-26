const { requireSocketAuth, requireSocketRole } = require('../../middlewares/socket.middleware');
const { buildSocketPayload, emitSocketEvent } = require('../../utils/socket.util');

const VISIT_NAMESPACE = '/ws/visits';
const GYM_ACTIVITY_EVENT = 'gym_activity';

let visitNamespace;

const buildVisitEmitPayload = ({ event, data, emittedFrom }) => {
    return buildSocketPayload({
        namespace: VISIT_NAMESPACE,
        event,
        data,
        emittedFrom
    });
};

const emitVisitActivity = ({ action, user, time = new Date(), emittedFrom = 'unknown' }) => {
    if (!visitNamespace) {
        throw new Error('Visit socket namespace is not initialized.');
    }

    const payload = emitSocketEvent({
        namespaceInstance: visitNamespace,
        namespace: VISIT_NAMESPACE,
        event: GYM_ACTIVITY_EVENT,
        data: {
            action,
            user,
            time: new Date(time).toISOString()
        },
        emittedFrom
    });

    return payload;
};

const initVisitSocket = (io) => {
    visitNamespace = io.of(VISIT_NAMESPACE);

    visitNamespace.use(requireSocketAuth);
    visitNamespace.use(requireSocketRole('pengurus'));
};

initVisitSocket.buildVisitEmitPayload = buildVisitEmitPayload;
initVisitSocket.emitVisitActivity = emitVisitActivity;

module.exports = initVisitSocket;