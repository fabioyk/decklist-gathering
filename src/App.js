import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

import Header from './components/Header';
import Decklist from './components/Decklist';

const formats = ['Standard', 'Modern', 'Legacy', 'Vintage', 'Pauper'];

const redditSearchURL = 'https://www.reddit.com/r/Magicdeckbuilding+spikes/search.json?sort=new&restrict_sr=on&limit=100';

const tappedoutAPI = 'http://tappedout.net/api/deck/widget/?sort=type&deck=';
const tappedoutWebRegex = new RegExp('(http://tappedout.net/mtg-decks/.*?/)', 'i');
const tappedoutDeckRegex = new RegExp('(\\d+x[\\s\\S]*?>.*<\\/a>)|Sideboard|(Planeswalker \\()','ig');
const tappedoutSecondRegex = new RegExp('<.*?><.*?>', 'i');

const deckstatsAPI = 'https://deckstats.net/api.php?action=get_deck&';
const deckstatsWebRegex = new RegExp('https://deckstats.net/.*?\\s','i');

/*
Text examples:
https://www.reddit.com/r/spikes/comments/2vjddz/moderninterest_in_infect_primer_from_top/
https://www.reddit.com/r/spikes/comments/2xkiow/moderninfect_primer_part_2_deck_construction/
https://www.reddit.com/r/spikes/comments/5nnx0y/modern_on_cats_and_combos_a_jeskai_copycat_primer/
https://www.reddit.com/r/spikes/comments/27hjq6/standard_uwr_control_primer_with_some_testing/
https://www.reddit.com/r/spikes/comments/5tzf2t/elder_deepfiend_interaction_and_eldrazi_in/

*/

class App extends Component {
  constructor(props) {
    super(props);

    this.organizeRedditData = this.organizeRedditData.bind(this);
    this.getFormatFromRedditThread = this.getFormatFromRedditThread.bind(this);
    this.getDecklistFromRedditThread = this.getDecklistFromRedditThread.bind(this);
    this.getDecklistFromFetch = this.getDecklistFromFetch.bind(this);

    /*this.state = {
      decklists: { 1:{
        key: '1',
        redditUserName: 'Ferdikoopman',
        subreddit: 'spikes',
        format: 'Modern',
        threadTitle: '[Modern] R/G Ponza Primer',
        decklist: '4 Arbor Elf<br/>2 Birds of Paradise<br/>2 Obstinate Baloth<br/>1 Stormbreath Dragon<br/>2 Thragtusk<br/>4 Inferno Titan<br/>4 Bonfire of the Damned<br/>2 Beast Within<br/>4 Stone Rain<br/>4 Mwonvuli Acid-Moss<br/>1 Primal Command<br/>1 Chandra, Torch of Defiance<br/>4 Utopia Sprawl<br/>4 Blood Moon<br/>9 Forest<br/>1 Mountain<br/>3 Stomping Ground<br/>4 Windswept Heath<br/>4 Wooded Foothills<br/>Sideboard:<br/>1 Grafdiggers Cage<br/>2 Ancient Grudge<br/>2 Sudden Shock<br/>3 Anger of the Gods<br/>1 Dismember<br/>1 Thrun, the Last Troll<br/>1 Fracturing Gust<br/>1 Stormbreath Dragon<br/>3 Kitchen Finks'
      }}
    };*/

    this.state = {
      decklists: {}
    };
  }

  componentDidMount() {
    fetch(redditSearchURL)
      .then(blob => blob.json())
      .then(this.organizeRedditData);
  }

  organizeRedditData(data) {
    let organizedData = {};

    data.data.children.forEach(child => {
      if ((child.data.selftext.indexOf('/tappedout.net/') !== -1) || (child.data.selftext.indexOf('/deckstats.net/') !== -1) ) {
        const deckData = this.getDecklistFromRedditThread(child);
        organizedData[child.data.id] = {
          redditUserName: child.data.author,
          subreddit: child.data.subreddit,
          format: this.getFormatFromRedditThread(child),
          threadTitle: child.data.title,
          decklist: deckData.promise,
          decklistUrl: deckData.url,
          key: child.data.id
        };
      }      
    });

    Object.keys(organizedData).forEach(key => {
      organizedData[key].decklist.then(data => {
        organizedData[key].decklist = this.getDecklistFromFetch(data);
      });
    });

    Promise.all(Object.keys(organizedData).map(key=>organizedData[key].decklist))
      .then(() => this.setState({decklists: organizedData}));

  }

  getFormatFromRedditThread(threadData) {
    const subreddit = threadData.data.subreddit;
    const linkFlair = threadData.data.link_flair_text;
    const threadTitle = threadData.data.title;

    let format;
    if (subreddit === 'Magicdeckbuilding') {
      format = linkFlair;
    } else if (subreddit === 'spikes') {
      format = linkFlair;
    }

    if (formats.indexOf(format) === -1) {
      format = 'Unknown';
    }

    return format;
  }

  getDecklistFromRedditThread(threadData) {
    const text = threadData.data.selftext;
    let isUrl = false;
    let url;
    let promiseUrl;
    if (!text) {
      isUrl = true;
      url = threadData.data.url;
    } else if (text.indexOf('/tappedout.net/') !== -1) {
      isUrl = true;
      url = text.match(tappedoutWebRegex)[0];
      const deckName = url.split('/')[4];
      promiseUrl = tappedoutAPI + deckName;      
    } else if (text.indexOf('/deckstats.net/') !== -1) {
      isUrl = true;
      url = text.match(deckstatsWebRegex)[0];

      let hasUser = true;
      promiseUrl = deckstatsAPI;
      const urlSplit = url.split('/');
      if (urlSplit[3] !== 'decks') {
        hasUser = false;
      }
      if (hasUser) {
        promiseUrl += 'owner_id=' + urlSplit[4] + '&id=' + urlSplit[5].split('-')[0] + '&id_type=saved';
      } else {
        const parts = urlSplit[3].split('-');
        promiseUrl += 'id=' + parts[1] + '&key=' + parts[2].split('.')[0] + '&id_type=temp';
      }
    }
    
    if (isUrl) {
      return {
        promise: fetch(promiseUrl)
                    .then(blob => blob.json()), 
        url: url};
    } else {
      return threadData.data.selftext;
    }
  }

  getDecklistFromFetch(data) {
    let cardCount = 0;

      // TAPPEDOUT
    if (data.url && data.url.indexOf('tappedout') !== -1) {
      let cards = data.board.match(tappedoutDeckRegex);
      cards = cards.map(card => {
        let newC = card.replace(tappedoutSecondRegex, '');
        newC = newC.replace(/&#39;/gi, "'");
        newC = newC.split('<')[0];
        return newC;
      });

      if (cards.indexOf('Planeswalker (') !== -1 && cards.indexOf('Sideboard') !== -1) {
        const indexOfSideboard = cards.indexOf('Sideboard');
        const indexOfPlaneswalker = cards.indexOf('Planeswalker (');
        if (indexOfPlaneswalker > indexOfSideboard) {
          //console.log('pre change: ',cards);        
          cards = [...cards.slice(0,indexOfSideboard), ...cards.slice(indexOfPlaneswalker+1), ...cards.slice(indexOfSideboard, indexOfPlaneswalker)];
          //console.log('post changes: ',cards);
        }
        
      }

      return cards.join('<br/>');

      // DECKSTATS
    } else if (data.success && data.list) {
      let cards = data.list;
      cards = cards.replace('//Main\n','')
                   .replace(/[\r\n]/gi, '<br/>')
                   .replace('SB: ','')
                   .replace('//','');
      return cards;
    }
    return 'not sure yet';
  }

  render() {
    return (
      <div className="App">
        <div className="App-header">
          <Header />
        </div>
        <div className="App-intro">
          {
            Object.keys(this.state.decklists).length > 0 ? 
              Object.keys(this.state.decklists).map(key =>
                <Decklist 
                  key={key}
                  redditUserName={this.state.decklists[key].redditUserName}
                  subreddit={this.state.decklists[key].subreddit}
                  format={this.state.decklists[key].format}
                  threadTitle={this.state.decklists[key].threadTitle}
                  decklist={this.state.decklists[key].decklist} />
              )
            :
              <p>Loading...</p>
                        
          }
        </div>
      </div>
    );
  }
}

export default App;
