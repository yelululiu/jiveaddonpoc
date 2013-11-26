var sfdcQueryer = require('./sfdcQueryer.js');

exports.query = {
    'verb' : 'get',
    'path' : '/sfdccase/salesforce/query',
    'route' : sfdcQueryer.handleSfdcQuery
};