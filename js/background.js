//chrome.storage.local.clear();

function Feedsite(_site)
{
    this.site  = _site;
    this.count = 0;
    this.available = true;
}

function Feed(_title, _url, _img, _time, _site, _width, _height, _count)
{
    this.title  = _title;
    this.url    = _url;
    this.img    = _img;
    this.time   = _time;
    this.site   = _site;
    this.width  = _width;
    this.height = _height;
    this.count  = _count;
}

var crawlerDone = false;
var feeds = [];
var feedSites = [];
var feedSize = 0;

getUserPrefs();

function getFeed()
{
    feedSize = 0;
    feeds.length = 0;
    crawlerDone = false;
    console.log("getFeed()", feedSites);
    
    if (feedSites.length == 0) {
        crawlerDone = true;
        return;
    }
    
    for (var i in feedSites) {
        /* Assume sites are available */
        feedSites[i].available = true;
        getFeedbyindex(i);
    }
    
    /* Update for every 200000ms */
    setTimeout(getFeed, 200000);
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
//            var date = JSON.parse(JSON.stringify(el.find('pubDate').text()), JSON.dateParser);
//            var date = new Date(el.find('pubDate').text());
//            var date = Date.parse(el.find('pubDate').text());
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
                var imageUrl = html.querySelector("meta[property='og:image']").getAttribute("content");
                var w = 0, h = 0;
                if(imageUrl) {
                    getImageMeta(imageUrl, function(width, height) {
                        feeds.push(new Feed(title, link, imageUrl, time, feedSites[i].site, width, height, feedSites[i].count));
                        if (feeds.length == feedSize) {
                            /* When jobs all done */
                            feeds.sort(function (a, b) {
                                return b.time - a.time;
                            });
                            /* Give some random */
                            for(var x = 0; x < feeds.length-1; x++) {
                                if(feeds[x].count < feeds[x+1].count && Math.random() < 0.5) {
                                    var temp = feeds[x];
                                    feeds[x] = feeds[x+1];
                                    feeds[x+1] = temp;
                                }
                            }
                            crawlerDone = true;
                        }
                    });
                } else {
                    /* If artical does not provide image */
                    feeds.push(new Feed(title, link, imageUrl, time, feedSites[i].site, 100, 100, feedSites[i].count));
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
        sendResponse({what:"getFeed", crawlerDone:crawlerDone, rss: feeds, size: feedSize, Sites: feedSites});
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
    feedSites.sort(function (a, b) {
        return b.count - a.count;
    });
    var LXRSS = JSON.stringify({"feedSites": feedSites});
    chrome.storage.local.set({LXRSS: LXRSS}, function() { 
        if(chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        }
    });
}

function getUserPrefs()
{
    var key = "LXRSS";
    chrome.storage.local.get(key, function (Prefs) {
        if(chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        }
        console.log(Prefs);
        if (!Prefs.LXRSS) {
            userPrefsInit();
        } else {
            console.log("getOldRss");
            feedSites = JSON.parse(Prefs.LXRSS).feedSites;
            console.log("feedSites=", feedSites);
            getFeed();
        }
    });
}
