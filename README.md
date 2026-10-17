# lebronify extension

a browser extension that turns every page you open into LeBron James, whether you wanted that or not.

Pictures become LeBron as they load. Every word on the page becomes the word lebron. Videos get rebuilt frame by frame while they play. You will not read anything real again, which for most of the internet is an improvement.

## How to use

**Install it, and a welcome page opens with one button.** Press the button and the extension turns itself on. Every page you open after that arrives already lebronified, and pages you already had open tend to catch up on their own. Click the toolbar icon to get the welcome page back. There are no settings and nothing else to configure, because there is nothing else it does.

### What it changes

| on the page | what happens | file types |
|---|---|---|
| pictures | rebuilt as LeBron when they load | png jpg jpeg gif bmp webp |
| video | rebuilt as LeBron frame by frame | mp4 webm |
| words | every word becomes lebron | all of them |

Pictures it can read get solved properly. Pictures it cannot read, because the browser blocks them for coming from another site, get a LeBron image drawn over the top instead. On your screen both versions look the same, and the difference only matters to people who open the developer tools for fun.

Videos get blocked for the same reason far more often than not, so plenty of them end up with the overlay as well. Your own local files usually work.

Words are replaced one at a time and the punctuation stays where it was, so a paragraph still ends like a paragraph. The word comes out lowercase because that is how the internet spells it.

## Installations

The extension is not on any store, because assorted stores have opinions about turning the entire web into LeBron. Load it yourself instead.

First get the files off GitHub. Click the green Code button on this page, then Download ZIP. Unzip it somewhere you will find again, your Desktop is fine. That unzipped folder is the extension.

Chrome or Edge:

1. Open chrome://extensions
2. Turn on Developer mode, the toggle in the top right
3. Click Load unpacked and pick the unzipped folder

Firefox:

1. Open about:debugging#/runtime/this-firefox
2. Click Load Temporary Add-on and pick manifest.json inside the unzipped folder

A temporary add-on goes away when you close Firefox, which is very much a Firefox thing.

## How it works

The extension carries the same WebAssembly engine as the website. For each image it reads the pixels, shrinks them onto a small grid, and solves the grid toward LeBron before painting the result back over the original. Everything runs on your machine and nothing is sent anywhere, which means no server, no account, and no analytics. Nobody is watching you do this.

The engine is obamify with LeBron as the target. The original is by Spu7Nix, and you should go look at it.

## License

MIT. See LICENSE.
