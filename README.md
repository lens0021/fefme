# Fefme: A Fediverse timeline for ME

This is a fork of <https://github.com/michelcrypt4d4mus/fedialgo_demo_app_foryoufeed>.

Cautions:

* I have removed several features from the original that were unnecessary for this fork.
* Much of this fork's code was written by AI agents. If you are uncomfortable with AI-generated code, please refer to the original project.

* Try the demo [here](https://lens0021.github.io/fefme/)

Each incoming post in your recent timeline will be scored based on a variety of factors and resorted top to bottom based on what posts have the highest scores instead of just reverse chronological order. You can adjust in a very fine grained way how much weight you want to give to each of those factors in determining each post's scores.

## Usage

1. Click on the link to [the demo](https://lens0021.github.io/fefme/). It's deployed on GitHub Pages so there is no server - everything is handled in your browser.
1. Specify the Mastodon server your account lives on and click "Login". If you're already logged in with that browser you won't have to enter a password. (Note: passwords and tokens are never sent to FediAlgo! Your login is strictly between you and your Mastodon server. Once authenticated your Mastodon server gives your browser a temporary token FediAlgo uses to read your timeline, the same as any other Mastodon client app.)
1. After you've logged in to your Mastodon server (or if you're already logged into that server in the browser you're using) your browser will request that you give `fedialgo` permission to access your Mastodon account. If you don't accept this the app will not work.
   You should see a permissions prompt that lists the OAuth scopes for reading your timeline, notifications, and posting interactions.
1. Wait for the magic. The first time you load the page it can take a while because it has to collect a bunch of federated data: things like trending posts on other servers, posts from accounts you follow, your notifications, and your recent Mastodon history so it can tell which users you interact with the most (which is by default an important part of the algorithm).
1. Have fun.
1. Profit.

If you try out FediAlgo but don't plan on using it again you may want to revoke its permissions. This can be done by going to `https://{YOUR_MASTODON_SERVER}/oauth/authorized_applications` and clicking the "revoke" button.

## Loading Behavior

Fefme keeps the UI stable during the first load:

* The app maintains two timeline caches: the current cache that is shown immediately (blue) and a next cache that is built in the background (green).
* When fresh data finishes loading, the next cache is saved and shown on the next page load. A floating "New posts" bubble appears if fresh data arrives.
* On the next refresh, the next cache becomes the current cache and the previous one is discarded. If a refresh happens before the next cache is ready, the current cache is reused.
* If no cache exists, the app shows only the loading screen until the first load completes.

## Setting Weights

Once the initial load is complete you can adjust the way the algorithm weights various aspects of a post when it decides what should be at or near the top of your feed.

One thing that's kind of a gotcha is the way the `topPosts - Favor posts that are trending in the Fediverse` slider works. Because trending posts often have tons of engagement in the form of replies, favorites, and boosts they can easily drown out the posts from people you are actually following. As a result the impact of this slider gets increasingly drastic _but only if the value is below 1.0_. At 1.0 and above it behaves like all the other weighting sliders.

### Filtering

You can filter based on hashtag, source (accounts you follow, hashtags you follow, various kinds of trending posts), language, application, and various numerical metrics like minimum number of replies, minimum number of boosts, etc.

The filter panels include source, language, and hashtag options, plus numeric thresholds for replies, boosts, and similar activity signals.

## Investigating A Post's Score

Clicking the ⚖️ in the GUI will bring up a popup that will show you the gory details of how a post measured up.

The score inspector shows the raw scoring inputs and the final weighted score for a post.

Here's an example of the elements that go into scoring a post:

This modal breaks down each factor (recency, engagement, follow status, etc.) and shows how the weights contribute to the final result.

## Boosting And Favoriting

* You can boost, bookmark, and favorite other people's posts through this app's web interface.
* Clicking the reply icon will take you to the standard Mastodon web app view of the post you want to reply to on your home server.
* Clicking the timestamp in the top right corner will take you to the post on that poster's home server (you'll only be able to reply if that's also your home server).

## Contributing

## Prerequisites

* [`node.js`](https://nodejs.org/)
* `git`

### Quick Start

1. `git clone https://github.com/lens0021/fefme`
1. `cd fefme`
1. `npm install` (you can ignore the various warnings)
1. `npm run dev`
   * It should automatically change focus to your default browser and prompt you to login to Mastodon but if that doesn't happen you can point your browser at [`http://localhost:3000/`](http://localhost:3000/).

You can install the local `fedialgo` package by running `npm link` in the `fedialgo` project dir and then `npm link fedialgo` in this project's dir _or_ you can do that kind of thing manually by running `npm install path/to/local/fedialgo` in this repo's dir but either way in order to pick up any code changes from `fedialgo` you will have to run `npm run build` in the `fedialgo` package dir.

### Debugging

You can overload a few environment variables by creating a `.env.development.local` file and adding your overrides to it.

If you set the environment variable `FEDIALGO_DEBUG=true` a _lot_ more debugging info will be printed to the browser console. See [`.env.development`](./.env.development) for other environment variables you can play with.

There's also an arrow icon at the top right of each post that will open a display showing the raw JSON of the underlying post.

#### Environment Variables

Environment variables are automatically loaded by Vite from `.env` files. There are files in this repo called `.env.production` and `.env.development` for the main two modes. To override the values in those files you can create files named `.env.production.local` and `.env.development.local`, respectively.

#### Code Notes

* There's tons of info on how the scoring and weighting of posts is being done in your browser's javascript debug console logs if `FEDIALGO_DEBUG` is set.
* The interesting stuff that actually handles the feed is in the [`Feed.tsx`](src/pages/Feed.tsx) file.
