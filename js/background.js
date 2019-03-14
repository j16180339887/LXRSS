//chrome.storage.local.clear();
//chrome.storage.sync.clear();

function Feedsite(_site)
{
    this.site  = _site;
    this.available = true;
}

function Feed(_title, _url, _img, _time, _site, _width, _height)
{
    this.title  = _title;
    this.url    = _url;
    this.img    = _img;
    this.time   = _time;
    this.site   = _site;
    this.width  = _width;
    this.height = _height;
}

var crawlerDoneBG = false;
var feeds = [];
var feedSites = [];
var feedSize = 0;

getUserPrefs();

function getFeed()
{
    feedSize = 0;
    feeds.length = 0;
    crawlerDoneBG = false;

    if (feedSites.length == 0) {
        crawlerDoneBG = true;
        return;
    }

    for (var i in feedSites) {
        /* Assume sites are available */
        feedSites[i].available = true;
        getFeedbyindex(i);
    }

    /* Update for every 100000ms */
    setTimeout(getFeed, 100000);
}

function getFeedbyindex(i)
{
    $.ajax({
    type: 'GET',
    url: feedSites[i].site,
    success: function(data) {
        var items = $(data).find("item");
        if(items.length === 0) {
            feedSites[i].available = false;
            return;
        }
        feedSize += items.length;
        items.each(function () {
            var el = $(this);
            var title = el.find("title").text();
            var link = el.find('link').text()
            var time = el.find('pubDate').text();

            if(!title || !link) {
                feedSites[i].available = false;
                return;
            }
            /* Iterate through all the images. */
            $.get(link, function (data) {
                if(!data) {
                    feedSites[i].available = false;
                    return;
                }
                var html =  document.createElement('html');
                html.innerHTML = data;
                var ogimage = html.querySelector("meta[property='og:image']")
                var firstImg = html.querySelector("img")
                var imageUrl = ogimage ? ogimage.getAttribute("content") : firstImg ? firstImg.getAttribute("src") : null
                var w = 0, h = 0;
                if(imageUrl) {
                    imageUrl = (! /^http/.test(imageUrl)) ? window.location.hostname+imageUrl : imageUrl
                    getImageMeta(imageUrl, function(width, height) {
                        /* Use union function in ES6 */
                        var search = feeds.filter(f => f.url === link);
                        if (search.length === 0) {
                            feeds.push(new Feed(title, link, imageUrl, time, feedSites[i].site, width, height));
                        }
                        if (feeds.length == feedSize) {
                            /* When jobs all done */
                            feeds.sort(function (a, b) {
                                return b.time - a.time;
                            });
                            crawlerDoneBG = true;
                        }
                    });
                } else {
                    /* If the artical does not provide an image */
                    var search = feeds.filter(f => f.url === link);
                    if (search.length === 0) {
                        feeds.push(new Feed(title, link, imageUrl, time, feedSites[i].site, 100, 100));
                    }
                }
            });
        });
    },
    error: function(XMLHttpRequest, textStatus, errorThrown) {
        console.log("Something wrong happened!");
            feedSites[i].available = false;
    }});
}

chrome.extension.onMessage.addListener( function(message, sender, sendResponse) {
    if(message.what == "getFeed") {
        sendResponse({what:"getFeed", crawlerDone:crawlerDoneBG, rss: feeds, size: feedSize, Sites: feedSites});
    } else if (message.what == "getNewFeed") {
        feedSites = feedSites.concat(message.newFeed);
        storeUserPrefs();
        getUserPrefs();
        sendResponse({what:"getNewFeed", rss: feeds, Sites: feedSites});
    } else if (message.what == "removeFeed") {
        feedSites = message.Sites;
        storeUserPrefs();
        getUserPrefs();
    } else if (message.what == "getNewClick") {
        feedSites = message.Sites;
        storeUserPrefs();
    }
});

function getImageMeta(url, callback)
{
    var img = new Image();
    img.src = url;
    img.onload = function() {
        callback(img.width, img.height);
    }
}

function userPrefsInit()
{
    /* Save Rss json for first time */
    feedSites = [];
    storeUserPrefs();
}

function storeUserPrefs()
{
    var LXRSS = JSON.stringify({"feedSites": feedSites});
    chrome.storage.sync.set({LXRSS: LXRSS}, function() {
        if(chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        }
    });
}

function getUserPrefs()
{
    var key = "LXRSS";
    chrome.storage.sync.get(key, function (Prefs) {
        if(chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        }
        if (!Prefs.LXRSS) {
            userPrefsInit();
        } else {
            feedSites = JSON.parse(Prefs.LXRSS).feedSites;
            getFeed();
        }
    });
}
