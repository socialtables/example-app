"use strict";
var request = require("request-promise");
var moment = require("moment");

module.exports = getNextEventWithTables;

/**
 * Example of VM3 API usage. Gets the next upcoming event for the provided
 * user, as well as the number of tables in the event's diagram.
 *
 * @param config: a configuration object containing API host URLs
 * @param teamID: the legacy team ID of the user
 * @param legacyUserID: the legacy playform user ID of the user in question
 * @param oauthToken: the OAuth bearer token for the user
 * @return: a promise resolbing a description of the user's next upcoming event
 *          with the following properties:
 *          - name: the event's name
 *          - id: the event's ID
 *          - startTime: the event's start time (human readable)
 *          - tableCount: rough number of tables in teh event
 */
function getNextEventWithTables(config, teamID, legacyUserID, oauthToken) {

	var authHeaders = { Authorization: `Bearer ${oauthToken}` };
	var event = null;
	var elements = [];

	// get upcoming events via legacy API
	return request({
		method: "GET",
		headers: authHeaders,
		uri: `${config.socialtables_api_host}/3.0/users/${legacyUserID}/events`,
		qs: {
			filter_from_date: new Date().toISOString(),
			sort: "start_time:asc"
		},
		json: true
	})
	// choose the first event from the list or leave it as null
	.then(function(eventsResponseBody) {
		var events = eventsResponseBody.data;
		if (events && events.length > 0) {
			event = events[0];
		}
	})
	// get floor elements for the event from the legacy API
	.then(function() {
		if (event) {
			return request({
				method: "GET",
				headers: authHeaders,
				uri: `${config.socialtables_api_host}/3.0/teams/${teamID}/events/${event.id}/elements`,
				json: true
			});
		}
	})
	// extract the floor element list from the response body
	.then(function(floorElementsResponseBody) {
		if (floorElementsResponseBody && floorElementsResponseBody.data) {
			elements = floorElementsResponseBody.data;
		}
	})
	// form a summary response and return
	.then(function() {
		if (event) {
			return {
				name: event.name,
				id: event.id,
				startTime: event.start_time ? moment(event.start_time).format("MMMM DD, YYYY") : "unknown",
				tableCount: elements
					.filter(element => (element.layout||"")
					.match(/table/))
					.length
			}
		}
		return null;
	});
}
