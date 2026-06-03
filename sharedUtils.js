var url = require('url')

exports.markedLinkProcessor = function({href, title, text}) {
  var parsedUrl = url.parse(href)
  if(!parsedUrl.protocol && parsedUrl.path && parsedUrl.path.slice(-3) === ".md") {
    href = parsedUrl.path.slice(0, -3)+".html"+(parsedUrl.hash?parsedUrl.hash:'')
  }
  return "<a href='"+href+"'>"+text+"</a>"
}