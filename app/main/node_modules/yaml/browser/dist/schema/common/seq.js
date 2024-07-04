import { createNode } from '../../doc/createNode.js';
import { isSeq } from '../../nodes/Node.js';
import { YAMLSeq } from '../../nodes/YAMLSeq.js';

function createSeq(schema, obj, ctx) {
    const { replacer } = ctx;
    const seq = new YAMLSeq(schema);
    if (obj && Symbol.iterator in Object(obj)) {
        let i = 0;
        for (let it of obj) {
            if (typeof replacer === 'function') {
                const key = obj instanceof Set ? it : String(i++);
                it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode(it, undefined, ctx));
        }
    }
    return seq;
}
const seq = {
    collection: 'seq',
    createNode: createSeq,
    default: true,
    nodeClass: YAMLSeq,
    tag: 'tag:yaml.org,2002:seq',
    resolve(seq, onError) {
        if (!isSeq(seq))
            onError('Expected a sequence for this tag');
        return seq;
    }
};

export { seq };
