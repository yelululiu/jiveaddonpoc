var cases = require('./cases'),
    jive = require('jive-sdk'),
    q = require('q');


function pullActivity(instance) {
    return cases.pullActivity(instance).then(function (data) {
        var promise = q.resolve(1);
        data.forEach(function (activity) {
            delete activity['sfdcCreatedDate'];
            promise = promise.thenResolve(jive.extstreams.pushActivity(instance, activity));
        });

        promise = promise.catch(function (err) {
            jive.logger.error('Error pushing activity to Jive', err);
        });

        return promise;
    });
}

exports.eventHandlers = [
    {
        'event' : 'sfdccasePullActivity',
        'handler' : function(context) {
            return pullActivity(context['instance']);
        }
    }
];
