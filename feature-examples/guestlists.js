"use strict";
let request = require("request-promise");
let moment = require("moment");

module.exports = getUpcomingGuestlist;

/**
 * Example of Guest API usage; pulls a list of upcoming events.
 *
 * @param config: a configuration object containing API host URLs
 * @param userID: the ID of the user for which to grab a guest list
 * @param oauthToken: the OAuth bearer token for the user
 * @return a promise resolving a list of upcoming events and the details
 *         of the first event in the list.
 */
function getUpcomingGuestlist(config, userID, oauthToken) {

	let authHeaders = { Authorization: `Bearer ${oauthToken}` };
	let now = moment();
	let upcomingEvents = [];
	let nextEvent = null;

	// get all events for the current user
	return request({
		method: "GET",
		headers: authHeaders,
		uri: `${config.socialtables_api_host}/4.0/events`,
		json: true
	})
	// count upcoming events, and choose the one closest to now
	.then(function(eventsBody) {
		if (eventsBody && eventsBody.length) {
			upcomingEvents = eventsBody
				.map(eventItem => eventItem.data)
				.filter(event => (event.start_epoch) && (moment(event.start_epoch) > now));
			upcomingEvents.sort((a,b) => (a.start_epoch >= b.start_epoch));
			nextEvent = upcomingEvents[0] || {};
		}
	})
	// return a summary of upcoming events and the first event's guestlist size
	.then(() => {
		return { upcomingEvents, nextEvent };
	});
}
