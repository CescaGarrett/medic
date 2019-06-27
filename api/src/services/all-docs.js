const db = require('../db'),
      authorization = require('./authorization'),
      _ = require('underscore');

const startKeyParams = ['startkey', 'start_key', 'startkey_docid', 'start_key_doc_id'],
      endKeyParams = ['endkey', 'end_key', 'endkey_docid', 'end_key_doc_id'];

const getRequestIds = (query, body) => {
  // CouchDB prioritizes query `keys` above body `keys`
  if (query && query.keys) {
    return JSON.parse(query.keys);
  }

  if (body && body.keys) {
    return body.keys;
  }

  if (query && query.key) {
    return [ JSON.parse(query.key) ]; // PouchDB stringifies before requesting
  }
};

const filterRequestIds = (allowedIds, requestIds, query) => {
  // if `key`/`keys` parameter is used, ignore `startKey`/`endKey` (CouchDB throws an error for such requests)
  if (requestIds) {
    return _.intersection(allowedIds, requestIds);
  }

  // support multiple startKey/endKey params in the same query, last one wins
  const startKeys = _.values(_.pick(query, (value, key) => startKeyParams.indexOf(key) !== -1)),
        endKeys = _.values(_.pick(query, (value, key) => endKeyParams.indexOf(key) !== -1));

  if (startKeys.length) {
    const startKey = _.last(startKeys);
    allowedIds = allowedIds.filter(docId => docId >= startKey);
  }

  if (endKeys.length) {
    const endKey = _.last(endKeys);
    if (query.inclusive_end === 'false') {
      allowedIds = allowedIds.filter(docId => docId < endKey);
    } else {
      allowedIds = allowedIds.filter(docId => docId <= endKey);
    }
  }

  return allowedIds;
};

// fills in the "gaps" for forbidden docs
const stubSkipped = (requestIds, result) => {
  return requestIds.map(docId =>
    _.findWhere(result, { id: docId }) || { id: docId, error: 'forbidden' }
  );
};

const formatResults = (results, requestIds) => {
  if (requestIds) {
    // if specific keys were requested, response rows should respect the order of request keys
    // and all of the requested keys should generate a response
    results.rows = stubSkipped(requestIds, results.rows);
  }

  return results;
};

const requestWithIncludeDocs = (authorizationContext, options) => {
  // filters response from CouchDB only to include successfully read and allowed docs
  const allowedRow = row => {
    return row.doc &&
           authorization.allowedDoc(row.id, authorizationContext, authorization.getViewResults(row.doc));
  };

  return db.medic
    .allDocs(options)
    .then(results => results.rows.filter(allowedRow))
    .then(rows => ({ rows }));
};

const withoutIncludeDocs = (authorizationContext, options, query) => {
  return authorization
    .getAllowedDocIds(authorizationContext)
    .then(allowedDocIds => {
      // when specific keys are requested, the expectation is to send deleted documents as well
      allowedDocIds = options.keys ?
        authorization.convertTombstoneIds(allowedDocIds) : authorization.excludeTombstoneIds(allowedDocIds);

      const filteredIds = filterRequestIds(allowedDocIds, options.keys, query);

      if (!filteredIds.length) {
        return { rows: [] };
      }

      options.keys = filteredIds;

      return db.medic.allDocs(options);
    });
};

module.exports = {
  // offline users will only receive results for documents they are allowed to see
  // mimics CouchDB response format, stubbing forbidden docs when specific `keys` are requested
  filterOfflineRequest: (userCtx, query, body) => {
    const requestIds = getRequestIds(query, body);

    return authorization
      .getAuthorizationContext(userCtx)
      .then(authorizationContext => {
        // remove all the `startKey` / `endKey` / `key` params from the request options, as they are incompatible with
        // `keys` and their function is already handled
        const options = _.defaults({ keys: requestIds }, _.omit(query, 'key', ...startKeyParams, ...endKeyParams));
        const includeDocs = query && query.include_docs;
        if (includeDocs && requestIds) {
          return requestWithIncludeDocs(authorizationContext, options);
        }

        return withoutIncludeDocs(authorizationContext, options, query);
      })
      .then(results => formatResults(results, requestIds));
  }
};

// used for testing
if (process.env.UNIT_TEST_ENV) {
  _.extend(module.exports, {
    _filterRequestIds: filterRequestIds,
    _getRequestIds: getRequestIds
  });
}
