const approvals = new Map();
/*
Record structure:
{
  tokenId,
  quoteId,
  status: NEW | USED,
  decision,
  comment,
  decidedBy,
  decidedAt
}
*/

module.exports = {
    create({ tokenId, quoteId }) {
        approvals.set(tokenId, {
            tokenId,
            quoteId,
            status: "NEW"
        });
    },

    find(tokenId) {
        return approvals.get(tokenId);
    },

    complete({ tokenId, decision, comment, decidedBy }) {
        const record = approvals.get(tokenId);
        if (!record) return null;

        record.status = "USED";
        record.decision = decision;
        record.comment = comment;
        record.decidedBy = decidedBy;
        record.decidedAt = new Date();

        return record;
    }
};
