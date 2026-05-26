const buildSocketPayload = ({
    namespace,
    event,
    data,
    emittedFrom,
    source = 'vocafit-backend'
}) => ({
    source,
    namespace,
    event,
    data,
    meta: {
        emitted_at: new Date().toISOString(),
        emitted_from: emittedFrom || 'unknown'
    }
});

const emitSocketEvent = ({ namespaceInstance, namespace, event, data, emittedFrom, source }) => {
    if (!namespaceInstance) {
        throw new Error(`Socket namespace is not initialized for ${namespace}.`);
    }

    const payload = buildSocketPayload({
        namespace,
        event,
        data,
        emittedFrom,
        source
    });

    namespaceInstance.emit(event, payload);
    return payload;
};

module.exports = {
    buildSocketPayload,
    emitSocketEvent
};
