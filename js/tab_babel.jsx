function Feedsite(_site)
{
    this.site  = _site;
    this.available = true;
}

var feeds = [];
var feedSites = [];

/* number of articles in one row */
var maxRowImage = 5;
var minRowImage = 2;
var maxRowNumber = 5;

/* the max width and height in one row */
var maxRowWidth  = 0;
var maxRowHeight = 0;
var marginSize = 0;

/* Smart retrying */
var MaxRery = 15;
var maxRery = MaxRery;
var cacheFLenth = -1;

initSize();
getFeedSites();
retryGetFeed();
// setTimeout(retryGetFeed, 2000); // Do it twice in case the feed is not ready
// setTimeout(retryGetFeed, 5000); // Do it three times in case the feed is not ready

function getFeedSites()
{
    chrome.extension.sendMessage({what: "getFeed"}, function(response) {
        if (response.what == "getFeed") {
            feedSites = response.Sites;
            renderControlPanel();
        }
    });
}

function retryGetFeed()
{
    chrome.extension.sendMessage({what: "getFeed"}, function(response) {

        if (response.what == "getFeed") {
            if (response.crawlerDone === true) {
                /* rss is enough to display */
                feeds = response.rss;
                feedSites = response.Sites;
                getFeedSites();
                if (!response.Sites) {
                    /*  When Chrome is onLoad at first time, js non-blocking will cause fucking null
                     *  value, this is preventing the null value by doing retryGetFeed again.
                     */
                    setTimeout(retryGetFeed, 500);
                }
                renderArticles();
            } else {
                /* rss is not enough to display, retry */
                if (maxRery <= 0) return;

                if (cacheFLenth === -1) {
                    cacheFLenth = response.rss.length;
                } else if (cacheFLenth === response.rss.length) {
                    maxRery--;
                    return;
                }
                maxRery = MaxRery;
                cacheFLenth = response.rss.length;
                feeds = response.rss;
                feedSites = response.Sites;
                setTimeout(retryGetFeed, 500);
                renderArticles();
            }
        }
});}

function renderArticles() {
    var ArticleComponent = React.createClass({
        handleClick: function(site) {

            var index = feedSites.map(function(obj) { return obj.site; }).indexOf(site);
            if (index !== -1) {
                chrome.extension.sendMessage({ what: "getNewClick", Sites: feedSites }, function(response) {
                    setTimeout(getFeedSites, 500);
                });
            }
        },
        render: function() {
            if (!feeds) {
                /*  When Chrome is onLoad at first time, js non-blocking will cause fucking null
                 *  value, this is preventing the null value by doing retryGetFeed again.
                 */
                setTimeout(retryGetFeed, 500);
                setTimeout(getFeedSites, 500);
                return null;
            }
            var links = [];
            var i = 0;
            var rowNumber = 0;
            while (i < feeds.length) {
                var rows = [];
                var rowSize = minRowImage;
                if(rowNumber >= maxRowNumber) {
                    /* Don't display too many Articles */
                    break;
                }
                while(rowSize+i > feeds.length) {
                    rowSize--;
                }
                var height = resizeImage(i, rowSize);
                while (height > maxRowHeight && rowSize+1 <= maxRowImage && rowSize+i < feeds.length) {
                    height = resizeImage(i, ++rowSize);
                }
                if(rowSize < maxRowImage && height > maxRowHeight && i < feeds.length) {
                    /* Handling height if Articles is running out */
                    height = maxRowHeight;
                }
                for (var n = 0; n < rowSize && i < feeds.length; n++) {
                    rows.push(
                        <figure style={{"height": height, "width": feeds[i].width * height / feeds[i].height, "margin-bottom": marginSize, "margin-right": marginSize}} className="imgContainer" onClick={this.handleClick.bind(this, feeds[i].site)} >
                            <a href={feeds[i].url} target="_blank">
                                <img src={feeds[i].img} border="0"/>
                                <h2>{feeds[i].title}</h2>
                            </a>
                        </figure>
                    );
                    i++;
                }
                links.push(<div className="rows">{rows}</div>);
                rowNumber++;
            }
            return( <div>{links}</div> );
        }
    });

    ReactDOM.render(
        <ArticleComponent />,
        document.querySelector("#articles")
    );
}

function renderControlPanel()
{
    var TableComponent = React.createClass({
        handleClick: function() {
            var checkboxs = document.querySelectorAll("input[type='checkbox']");
            var checkOrNot = document.querySelector("#selectAllCheckbox").checked;
            for(var i = 0; i < checkboxs.length; i++) {
                checkboxs[i].checked = checkOrNot;
            }
            return false;
        },
        render: function() {
            if (!feedSites) {
                /*  When Chrome is onLoad at first time, js non-blocking will cause fucking null
                 *  value, this is preventing the null value by doing retryGetFeed again.
                 */
                setTimeout(retryGetFeed, 500);
                setTimeout(getFeedSites, 500);
                return null;
            }
            var urls = [];
            urls.push(
                <tr width="100%" height="10%" >
                    <td width="10%" ><input type="checkbox" id="selectAllCheckbox" onClick={this.handleClick} /></td>
                    <td width="80%">Url</td>
                    <td width="10%">Health</td>
                </tr>
            );
            for (var i = 0; i < feedSites.length; i++) {
                var health = feedSites[i].available ? <font color="green">Good</font> : <font color="red">Bad</font>;
                var site = feedSites[i].available ? <font color="green">{feedSites[i].site}</font> : <font color="red">{feedSites[i].site}</font>
                urls.push(
                    <tr width="100%" height="10%" >
                        <td width="10%" ><input type="checkbox" data-site={feedSites[i].site} /></td>
                        <td width="80%" ><a href={feedSites[i].site} target="_blank">{site}</a></td>
                        <td width="10%" >{health}</td>
                    </tr>
                );
            }
            if (feedSites.length < 8) {
                /* Push empty url just for better looking :) */
                for (var i = 0; i < 8 - feedSites.length; i++) {
                    urls.push(
                        <tr width="100%" height="10%" >
                            <td width="10%"></td>
                            <td width="70%"></td>
                            <td width="10%"></td>
                            <td width="10%"></td>
                        </tr>
                    );
                }
            }
            return( <table id="sidebarScrollTable" >{urls}</table> );
        }
    });
    ReactDOM.render(
        <TableComponent />,
        document.querySelector("#sidebarScrollList")
    );
}

document.querySelector("#fileToLoad").onchange = function(e) {
    var fileToLoad = document.getElementById("fileToLoad").files[0];
    var fileReader = new FileReader();
    var textFromFileLoaded = "";
    fileReader.onload = function(fileLoadedEvent) {
        var urls = fileLoadedEvent.target.result.split(/[\s,;\t\n]+/g);
        var newfeed = [];
        for (var i in urls) {
            var index = feedSites.map(function(obj) { return obj.site; }).indexOf(urls[i]);
            if (index === -1) {
                newfeed.push(new Feedsite(urls[i]));
            }
        }
        if (newfeed.length !== 0) {
            chrome.extension.sendMessage({ what: "getNewFeed", newFeed: newfeed }, function(response) {
                feeds = response.rss;
                retryGetFeed();
                getFeedSites();
            });
        }
    };
    fileReader.readAsText(fileToLoad, "UTF-8");
    return false;
};

document.querySelector("#sidebarImportSubmit").onclick = function(e) {
    document.querySelector("#fileToLoad").click();
    return false;
};

document.querySelector("#sidebarExportSubmit").onclick = function(e) {
    var textToSave = "";
    if(feedSites.length == 0) {
        return;
    } else {
        textToSave += feedSites[0].site;
    }
    for (var i = 1; i < feedSites.length; i++) {
        textToSave += "\n" + feedSites[i].site;
    }

    var textToSaveAsBlob = new Blob([textToSave], {type:"text/plain"});
    var textToSaveAsURL = window.URL.createObjectURL(textToSaveAsBlob);
    var fileNameToSaveAs = "LXRSS.txt";

    var downloadLink = document.createElement("a");
    downloadLink.download = fileNameToSaveAs;
    downloadLink.innerHTML = "Download File";
    downloadLink.href = textToSaveAsURL;
    downloadLink.style.display = "none";

    /*
    downloadLink.onclick = function(event){
        document.body.removeChild(event.target);
    };
    document.body.appendChild(downloadLink);*/

    downloadLink.click();
    return false;
};

document.querySelector("#sidebarAddSubmit").onclick = function(e) {
    var newUrl = document.querySelector("input#textFiled").value;
    var urls = newUrl.split(/[\s,;\t\n]+/g);
    var newfeed = [];
    for (var i in urls) {
        var index = feedSites.map(function(obj) { return obj.site; }).indexOf(urls[i]);
        if (index === -1) {
            newfeed.push(new Feedsite(urls[i]));
        }
    }
    if (newfeed.length !== 0) {
        chrome.extension.sendMessage({ what: "getNewFeed", newFeed: newfeed }, function(response) {
            feeds = response.rss;
            retryGetFeed();
            getFeedSites();
            setTimeout(retryGetFeed, 1500); // Do it twice in case the feed is not ready
            setTimeout(renderArticles, 2000); // Do it twice in case the feed is not ready
            setTimeout(retryGetFeed, 4500); // Do it three times in case the feed is not ready
            setTimeout(renderArticles, 5000); // Do it three times in case the feed is not ready
        });
    }

    return false;
};

document.querySelector("#sidebarRemove").onclick = function(e) {
    if (feeds.length != 0) {
        var checkboxs = document.querySelectorAll("input[type='checkbox']");
        for(var i = 1; i < checkboxs.length; i++) {
            if (checkboxs[i].checked) {
                var site = checkboxs[i].getAttribute("data-site");
                var index = feedSites.map(function(obj) { return obj.site; }).indexOf(site);
                if (index !== -1) {
                    feedSites.splice(index, 1);
                }
            }
        }
        renderControlPanel();
        chrome.extension.sendMessage({what: "removeFeed", Sites: feedSites}, function(response) {
            retryGetFeed();
        });
    }
    return false;
};

document.querySelector("#showSetting").onclick = function(e) {
    document.querySelector("aside").style.display = "block";
    document.querySelector("input#textFiled").focus();
    return false;
};

document.querySelector("#hideSetting").onclick = function(e) {
    document.querySelector("aside").style.display = "none";
    return false;
};

window.onscroll = function(e) {
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight)
    {
        /* IF scrolled to the buttom */
        maxRowNumber += 5;
        renderArticles();
    }
}

window.onresize = function(e) {
    initSize();
    renderArticles();
    renderControlPanel();
};

function initSize()
{
    maxRowWidth  = window.innerWidth * 0.9;
    maxRowHeight = window.innerHeight * 0.3;
    marginSize = window.innerWidth * 0.01;
}

function resizeImage(index, num)
{
    var rowHeight = feeds[index].height;
    var rowWidth  = feeds[index].width;

    for (var i = index+1; i < index+num; i++) {
        rowWidth += feeds[i].width * rowHeight / feeds[i].height;
    }
    return rowHeight * (maxRowWidth - num*marginSize) / rowWidth;
}
