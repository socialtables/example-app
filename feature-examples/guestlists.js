"use strict";
var request = require("request-promise");
var moment = require("moment");

module.exports = getUpcomingGuestlist;

/**
 * Example of Guest API usage; pulls a list of upcoming events and gets
 * the number of guests in the chronological first.
 *
 * @param config: a configuration object containing API host URLs
 * @param userID: the ID of the user for which to grab a guest list
 * @param oauthToken: the OAuth bearer token for the user
 * @return a promise resolving a list of upcoming events and the details
 *         of the first event in the list.
 */
function getUpcomingGuestlist(config, userID, oauthToken) {

	var authHeaders = { Authorization: `Bearer ${oauthToken}` };
	var now = moment();
	var upcomingEvents = [];
	var nextEvent = null;

	// get all events for the current user
	return request({
		method: "GET",
		headers: authHeaders,
		uri: `${config.socialtables_events_api_host}/events`,
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
	// if there is a next event, look up some details about it
	.then(function() {
		nextEvent = upcomingEvents[0];
		if (nextEvent) {
			// all of the subsequent lookup relies on an event, so we'll inline
			// the requests under this .then block
			return request({
				method: "GET",
				headers: authHeaders,
				uri: `${config.socialtables_events_api_host}/events/${nextEvent.id}/sessions`,
				json: true
			})
			// each event has at least (and currently at most) one session
			.then(function(eventSessionsBody) {
				var session = eventSessionsBody[0];
				if (session && session.id) {
					return request({
						method: "GET",
						headers: authHeaders,
						uri: `${config.socialtables_guestlist_api_host}/sessions/${session.id}/guestlists`,
						json: true
					});
				}
			})
			// each session has at least (and currently at most) one guest list
			.then(function(guestlistsBody) {
				var guestlist = guestlistsBody[0];
				if (guestlist && guestlist.id) {
					return request({
						method: "GET",
						headers: authHeaders,
						uri: `${config.socialtables_guestlist_api_host}/guestlists/${guestlist.id}/guests`,
						json: true
					});
				}
			})
			// if everything went ok, add a guest count to the first event description
			.then(function(guests) {
				nextEvent = Object.assign({}, nextEvent, { guestCount: guests.length} );
			});
		}
	})
	// return a summary of upcoming events and the first event's guestlist size
	.then(() => {
		return { upcomingEvents, nextEvent };
	});
}
