// ==UserScript==
// @name         知乎 - 黑名单评论一键屏蔽
// @namespace    https://greasyfork.org/zh-TW/users/236684-pionxzh
// @version      0.1
// @source       https://github.com/pionxzh/zhihu-block/
// @description  自动屏蔽来自黑名单的所有评论与文章
// @author       Pionxzh
// @match        *.zhihu.com/*
// @require      https://cdn.staticfile.org/jquery/3.4.1/jquery.slim.min.js
// @grant        none
// ==/UserScript==

class Cookie {
    /**
     * Get cookie content object which contain all the item
     * @param {string} cName - CookieName.
     */
    static getData () {
        let cookie = {}
        document.cookie.split(';').forEach(item => {
            let [k, v] = item.split('=')
            cookie[decodeURIComponent(k.trim())] = decodeURIComponent(v)
        })
        return cookie
    }

    /**
     * Get specific cookie item by the name
     * @param {string} cName - CookieName.
     */
    static getItem (cName) {
        const data = this.getData()
        return data[decodeURIComponent(cName)] || null
    }

    /**
    * Set cookie item by the name
    * @param {string} cName   - CookieName.
    * @param {string} cValue  - CookieValue.
    * @param {string} expDay  - Expire after expDay days.
    * @param {string=} domain - (Optional) Cookie domain.
    * @param {string=} path   - (Optional) Cookie path. Default "/"
    */
    static setItem (cName, cValue, expDay, domain, path='/') {
        if (domain === undefined) domain = window.location.hostname.replace(/www\./i, '.')

        let date = new Date()
        date.setTime(date.getTime() + (expDay * 24 * 60 * 60 * 1000))
        let expires = `expires=${date.toUTCString()}`

        document.cookie = `${encodeURIComponent(cName)}=${encodeURIComponent(cValue)};${expires};domain=${domain};path=${path}`
    }
}

(function() {
    'use strict'

    let blockedUser = []

    function saveData () {
        // localStorage.setItem('zh-blocker', JSON.stringify(blockedUser))
        // Using cookie to overcome the limit of cross-subdomain
        let data = blockedUser.map(item => {
            delete item.name
            return item
        })
        Cookie.setItem('zh-blocker', JSON.stringify(data), 7)
    }

    function restoreData () {
        try {
            // blockedUser = JSON.parse(localStorage.getItem('zh-blocker'))
            blockedUser = JSON.parse(Cookie.getItem('zh-blocker'))
        } catch (e) {
            blockedUser = []
            console.error(e)
        }
    }

    function getBlockedUserData () {
        let offset = 0
        // default limit: 6
        let limit = 10
        let fetchData = () => {
            fetch(`https://www.zhihu.com/api/v3/settings/blocked_users?offset=${offset}&limit=${limit}`)
            .then(response => {
                return response.json()
            }).then(res => {
                if (!(res && res.data)) return

                offset = offset + limit
                res.data.forEach(el => {
                    blockedUser.push({
                        id: el.id,
                        name: el.name,
                        url: el.url_token
                    })
                })

                res.paging.is_end ? saveData() : fetchData()
            }).catch(err => {
                // 401 专栏文章无法抓取黑名单
                console.error(err)
                restoreData()
            })
        }

        fetchData()
    }

    function blockContent () {
        // console.log('block!')

        blockedUser.forEach(user => {
            // https://www.zhihu.com/explore/
            $(`div.feed-item:has(a.author-link[href*='${user.url}'])`).hide()
            $(`div.comment-app-holder div[class*='CommentItem_root'][aria-label='${user.name}的评论']`).hide()

            // https://www.zhihu.com/follow
            $(`div.Card:has(div.AuthorInfo a.UserLink-link[href*='/people/${user.url}'])`).hide()

            // https://www.zhihu.com/topic
            $(`div.feed-item:has(div.AuthorInfo div.zm-item-answer-author-info[href*='/people/${user.id}'])`).hide()
            $(`div[class*='CommentItem_root']:has(a[href*='/people/${user.id}'])`).hide()
            $(`div[class*='CommentItem_root']:has(a[href*='/people/${user.url}'])`).hide()

            // Hide normal comment
            // https://www.zhihu.com/question/*
            $(`div.CommentItemV2:has(a.UserLink-link[href*='${user.id}'])`).hide()
            $(`div.CommentItemV2:has(a.UserLink-link[href*='/people/${user.url}'])`).hide()

            $(`div.AnswerCard:has(div.AuthorInfo a.UserLink-link[href*='${user.id}'])`).hide()
            $(`div.AnswerCard:has(div.AuthorInfo a.UserLink-link[href*='/people/${user.url}'])`).hide()
        })
    }
    /*
    function hookAjax (cb) {
        let originalOpen = XMLHttpRequest.prototype.open

        XMLHttpRequest.prototype.open = function() {
            this.addEventListener('loadend', customCallback)
            originalOpen.apply(this, arguments)
        }

        let customCallback = function () {
            cb()
            this.removeEventListener('loadend', customCallback)
        }
    }
    */
    function addMutationOb () {
        let observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type != 'childList' || mutation.removedNodes.length !== 0) return
                blockContent()
            })
        })
        observer.observe(document, {childList: true, subtree: true})
    }

    function init () {
        // hookAjax(blockContent)
        addMutationOb()
        getBlockedUserData()
    }

    init()
})()
