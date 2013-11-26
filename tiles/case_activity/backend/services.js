var jive = require('jive-sdk'),
    q = require('q');

function processTileInstance(instance) {
    var eventContext = { 'eventListener' :'sfdccase', 'instance' : instance };

    //
    // 1. pull activity from SFDC and push to Jive
    jive.context.scheduler.schedule('sfdccasesPullActivity', eventContext );
}

exports.task = new jive.tasks.build(
    // runnable
    function () {
        jive.extstreams.findByDefinitionName('case_activity').then(function (instances) {
            if (instances) {
                instances.forEach(function (instance) {
                    processTileInstance(instance);
                });
            }
        });
    },

    // interval (optional)
    100000
);