/*
 * This script has been written to be executed within PhantomJS.
 */

function usage() {
	console.log("Usage: urlgrabber.js [options] <url> [...]");
	console.log("Options:");
	console.log("- concurrency=N");
	console.log("     Number of concurrent queries (default: 4)");
	console.log("- filter-query-string=<0|1>");
	console.log("     Filter out query string from grabbed URLs (default: 0)");
	console.log("- filter-hash-tag=<0|1>");
	console.log("     Filter out fragments from grabbed URLs (default: 0)");
	console.log("- filter-regex=<regex>");
	console.log("     Filter out URLs that do not match this regex");
	console.log("Note:");
	console.log("  It is strongly advise to use a regular expression in order");
	console.log("  to avoid crawling the entire world wide web.");
}

/*
 * This function is executed as in the context of a loaded webpage.
 */
function getPageInfo(filterqs, filterht, filterre) {
	var qsre = null;
	var htre = null;
	var filre = null;
	var a = new Array();
	var b = new Array();
	var i;

	// Query strings comes before hash tags in URLs.
	if (filterqs)
		qsre = new RegExp('([^?]*)(\\?[^#]*)?');
	if (filterht)
		htre = new RegExp('([^#]*)(#.*)?');
	if (filterre != null)
		filre = new RegExp(filterre);
	httpre = new RegExp("^https?\:\/\/");

	for (i = 0; i < document.links.length; i++) {
		if (!document.links[i].href.match(httpre))
			continue;
		if (filre != null &&
		    !document.links[i].href.match(filre))
			continue;
		var s = document.links[i].href;
		if (htre != null)
			s = s.replace(htre, '$1');
		if (qsre != null)
			s = s.replace(qsre, '$1');
		if (typeof(a[s]) !== 'undefined')
			continue;
		a[s] = 1;
		b.push(s);
	}
	return {
	    'title' : document.title,
	    'links' : b
	};
}

/*
 * Job class
 */
function Job(url) {
	//console.log("New job for " + url);
	console.log(url);
	this.page = require('webpage').create();
	this.url = url;
	Job.prototype.running += 1;
}

Job.prototype.running = 0;
Job.prototype.todo = new Array();
Job.prototype.visited = new Array();
Job.prototype.tsre = new RegExp("/$");	// trailing slash

Job.prototype.run = function(filterqs, filterht, filterre) {
	var job = this;
	var jobclass = Job;

	this.page.onLoadStarted = function() {
		//console.log("# Starting " + job.url);
		job._t = Date.now();
		//jobclass.prototype.running += 1;
	}

	this.page.onLoadFinished = function(status) {
		if (status != "success") {
			console.log("FAILED to load " + job.url);
		} else {
			job.loadtime = Date.now() - job._t;
			/*
			console.log("# Done " + job.url + " in " +
			    job.loadtime + " msec");
			*/
			var pageinfo = job.page.evaluate(getPageInfo,
			    filterqs, filterht, filterre);
			
			job.page.release()
			job.page = null;	// free mem asap
			jobclass.prototype.running -= 1;

			/*
			console.log('# Page title of ' + job.url + 
			    ' is ' + pageinfo.title +
			    ' (' + pageinfo.links.length + ' links)');
			*/

			var i;
			for (i = 0; i < pageinfo.links.length; i++) {
				url = pageinfo.links[i];
				url = url.replace(Job.prototype.tsre, '');
				if (pageinfo.links[i] in Job.prototype.visited)
					continue;
				Job.prototype.visited[pageinfo.links[i]] = 1;
				Job.prototype.todo.push(pageinfo.links[i]);
				console.log(pageinfo.links[i]);
			}
		}
	}

	this.page.open(this.url);
}

var system = require('system');
if (system.args.length <= 1) {
    console.log('Missing argument!');
    phantom.exit();
}

var filterqs = 0;	// Filter query string in URLs
var filterht = 0;	// Filter hash tags in URLs
var filterre = null;	// Only catch URLs matching this regex
var concurrency = 4;	// Number of concurrent requests

var args = system.args.slice(1);
while (true) {
	//var arg1 = system.args[1];
	var arg1 = args[0];
	if (arg1.search("help") == 0 || arg1.search("-h") == 0) {
		usage();
		phantom.exit();
	} else if (arg1.search("filter-query-string=") == 0) {
		i = arg1.search("=") + 1;
		filterqs = parseInt(arg1.substr(i));
	} else if (arg1.search("filter-hash-tag=") == 0) {
		i = arg1.search("=") + 1;
		filterht = parseInt(arg1.substr(i));
	} else if (arg1.search("filter-regex=") == 0) {
		i = arg1.search("=") + 1;
		filterre = arg1.substr(i);
	} else if (arg1.search("concurrency=") == 0) {
		i = arg1.search("=") + 1;
		concurrency = parseInt(arg1.substr(i));
	} else {
		break;
	}
	//system.args.splice(0, 1, "");
	args = args.slice(1);
}

/*
console.log("### filter-query-string: " + filterqs);
console.log("### filter-hash-tag: " + filterht);
console.log("### filter-regex: " + filterre);
console.log("### concurrency: " + concurrency);
*/

var urls = args;

for (var i = 0; i < urls.length; i++)
	Job.prototype.todo.push(urls[i]);

var exiting = 0;

/*
 * Make a function to use setTimeout().
 */
function mainloop() {
	/* Poor man's concurrency :-). */
	while (Job.prototype.running < concurrency) {
		url = Job.prototype.todo.shift();
		if (url == undefined)
			break;
		var job = new Job(url);
		job.run(filterqs, filterht, filterre);
	}
	url = null;
	job = null;
	setTimeout(mainloop, 1000);
	return;
}

function wait2exit() {
	if (Job.prototype.running + Job.prototype.todo.length != 0) {
		exiting = 0;
		return;
	}
	if (exiting == 0) {
		exiting = 1;
		setTimeout(wait2exit, 1000);
	}
	phantom.exit();
}

setTimeout(mainloop, 0);
setTimeout(wait2exit, 1000);
