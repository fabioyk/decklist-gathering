import React from 'react';

class Decklist extends React.Component {
  render() {
    return (
      <div className='decklist'>
        <h3><span className={this.props.format}>{this.props.format}</span>: {this.props.threadTitle}</h3>
        <p>from {this.props.redditUserName} at {this.props.subreddit}</p>
        <p dangerouslySetInnerHTML={{__html: this.props.decklist}}></p>
      </div>
    );
  }
}

Decklist.propTypes = {
  redditUserName: React.PropTypes.string.isRequired,
  subreddit: React.PropTypes.string.isRequired,
  decklist: React.PropTypes.string.isRequired,
  format: React.PropTypes.string.isRequired,
  threadTitle: React.PropTypes.string.isRequired
}

export default Decklist;