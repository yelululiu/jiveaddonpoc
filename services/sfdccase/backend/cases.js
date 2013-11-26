var jive = require("jive-sdk");
var url = require('url');
var util = require('util');
var sfdc_helpers = require('./sfdc_helpers');
var q = require('q');

var metadataCollection = "sfdccaseActivityMetadata";
var metadataStore = jive.service.persistence();

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Public

/**
 * Pulls case activity from SFDC since the last time it was pulled, for the opportunity encoded in the
 * passed in external stream instance object. The 'ticketID' in the instance object is used to
 * look up the SFDC access token that will be used to query SFDC for the activity.
 * @param extstreamInstance
 * @return array of activity objects
 */
exports.pullActivity = function(extstreamInstance) {

    return exports.getLastTimePulled(extstreamInstance, 'activity').then(function (lastTimePulled) {
        var ticketID = extstreamInstance.config.ticketID;

        //First query text posts
        var queryTextPosts = util.format("SELECT Id, Type, CreatedDate, CreatedBy.Name, Parent.Name, IsDeleted, Body, (SELECT Id, FieldName, OldValue, NewValue" +
            " FROM FeedTrackedChanges ) FROM OpportunityFeed" +
            " WHERE ParentId = '%s' AND CreatedDate > %s ORDER BY CreatedDate ASC",
            opportunityID,
            getDateString(lastTimePulled));
        var uri1 = util.format("/query?q=%s", encodeURIComponent(queryTextPosts));

        return sfdc_helpers.querySalesforceV27(ticketID, uri1).then(function (response) {
            var entity = response['entity'];
            return convertToActivities(entity, lastTimePulled, extstreamInstance);
        });

    }).catch(function (err) {
        jive.logger.error('Error querying salesforce', err);
    });
};


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Private


function convertToActivities(entity, lastTimePulled, instance) {
    var records = entity['records'];
    var activities = records.map(function (record) {
        var json = getActivityJSON(record);
        if (!isNaN(json['sfdcCreatedDate'])) {
            lastTimePulled = Math.max(lastTimePulled, json['sfdcCreatedDate']);
        }
        return json;
    });

    return exports.updateLastTimePulled(instance, lastTimePulled, 'activity').thenResolve(activities);
}

function getActivityJSON(record) {
    var actor = record.CreatedBy && record.CreatedBy.Name || 'Anonymous';
    var oppName = record.Parent && record.Parent.Name || 'Some Opportunity';
    var externalID = record.Id;
    var createdDate = new Date(record.CreatedDate).getTime();

    var body = null;
    if (record.Type == 'TextPost') {
        body = record.Body;
    }
    else if (record.Type == 'TrackedChange') {
        var changes = record.FeedTrackedChanges && record.FeedTrackedChanges.records;
        if (changes && changes.length > 0) {
            var lastChange = changes[changes.length - 1];
            body = actor + ' changed ' + lastChange.FieldName.replace('Opportunity\.', '') + ' from '
                + lastChange.OldValue + ' to ' + lastChange.NewValue + '.';
        }
    }

    body = body || 'Empty post';

    return {
        "sfdcCreatedDate": createdDate,
        "activity": {
            "action": {
                "name": "posted",
                "description": body
            },
            "actor": {
                "name": actor,
                "email": "actor@email.com"
            },
            "object": {
                "type": "website",
                "url": "http://www.salesforce.com",
                "image": "http://farm6.staticflickr.com/5106/5678094118_a78e6ff4e7.jpg",
                "title": oppName,
                "description": body
            },
            "externalID": externalID
        }
    }
}

function getDateString(time) {
    return new Date(time).toISOString().replace(/Z$/, '+0000');
}

function getMetadataByInstance(instance) {
    return metadataStore.find(metadataCollection, {'instanceID': instance['id']}).then(function (results) {
        if (results.length <= 0) {
            return null;
        }
        return results[0];
    });
}

function wasSynced(instance, sfCommentID) {
    return getMetadataByInstance(instance).then(function (metadata) {
        return metadata && metadata.syncs && metadata.syncs.indexOf(sfCommentID) >= 0;
    });
}
