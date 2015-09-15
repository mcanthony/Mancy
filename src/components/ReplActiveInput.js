import React from 'react';
import _ from 'lodash';
import repl from 'repl';
import {Readable, Writable} from 'stream';
import {EOL} from 'os';
import shell from 'shell';
import ReplSuggestionActions from '../actions/ReplSuggestionActions';
import ReplActions from '../actions/ReplActions';
import ReplConstants from '../constants/ReplConstants';
import ReplType from '../common/ReplType';

export default class ReplActiveInput extends React.Component {
  constructor(props) {
    super(props);
    this.onTabCompletion = this.onTabCompletion.bind(this);
    this.autoComplete = this.autoComplete.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }
  componentDidMount() {
    this.element = React.findDOMNode(this);
    this.focus();
    let cli = ReplActiveInput.getRepl();
    cli.output.write = this.addEntry.bind(this);
    //scroll to bottom
    window.scrollTo(0, document.body.scrollHeight);
  }

  componentWillUnmount() {
    let cli = ReplActiveInput.getRepl();
    cli.output.write = () => {};
  }

  focus() {
    // focus
    this.element.focus();

    //set cursor at end
    let range = document.createRange();
    range.selectNodeContents(this.element);
    range.collapse(false);
    let selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  addEntry(buf) {
    let entry = buf.toString();
    if(entry.length === 0 || entry === '...') return;
    // console.log(entry);
    const text = this.element.innerText.trim();
    ReplActions.addEntry({entry: entry, status: true, command: text});
    ReplSuggestionActions.removeSuggestion();
    this.element.innerText = '';
  }

  autoComplete(__, completion) {
    let [list, ] = completion;
    // console.log('autocomplete', list)
    let suggestions = _.chain(list)
      .filter((suggestion) => {
        return suggestion && suggestion.length !== 0;
      })
      .map((suggestion) => {
        return {
          type: ReplType.typeOf(suggestion),
          text: suggestion
        };
      })
      .value();
    // console.log(ReplSuggestionActions)
    if(suggestions.length) {
      const text = this.element.innerText;
      ReplSuggestionActions.addSuggestion({suggestions: suggestions, input: text});
    } else {
      ReplSuggestionActions.removeSuggestion();
    }
  }

  onTabCompletion(__, completion) {
    let [list, input] = completion;
    if(list.length === 0) {
      shell.beep();
      ReplSuggestionActions.removeSuggestion();
    } else if(list.length === 1) {
      const text = this.element.innerText;
      let lines = text.split(EOL);
      let currentLine = lines.length - 1;
      lines[currentLine] = lines[currentLine].replace(input, '') + list[0];
      this.element.innerText = lines.join(EOL);
      ReplSuggestionActions.removeSuggestion();
    } else {
      this.autoComplete(__, completion);
    }
    this.focus();
  }

  onKeyUp(e) {
    if(ReplActiveInput.isTab(e) || ReplActiveInput.isEscape(e)) { return; }

    let cli = ReplActiveInput.getRepl();
    const text = this.element.innerText.trim();
    var lines = text.split(EOL);
    if(ReplActiveInput.isEnter(e)) {
      // emit last line
      var lastLine = lines[lines.length - 1];
      cli.input.emit('data', lastLine);
      cli.input.emit('data', EOL);
    } else {
      cli.complete(text, this.autoComplete);
    }
  }

  onKeyDown(e) {
    if(!ReplActiveInput.isTab(e)) { return; }

    const text = this.element.innerText.trim();
    let cli = ReplActiveInput.getRepl();
    cli.complete(text, this.onTabCompletion);

    // avoid focus loss
    e.preventDefault();
  }
  render() {
    return (
      <div className='repl-active-input' tabIndex="-1" contentEditable={true}
        onKeyUp={this.onKeyUp}
        onKeyDown={this.onKeyDown}>
      </div>
    );
  }

  static isTab(e) {
    return e.key === 'Tab';
  }

  static isEnter(e) {
    return e.key === 'Enter';
  }

  static isEscape(e) {
    return e.key === 'Escape';
  }

  static getRepl = (() => {
    let readable = new Readable();
    let writable = new Writable();

    readable._read = writable.write = () => {};

    let nodeRepl = repl.start({
      prompt: '',
      input: readable,
      output: writable,
      terminal: false,
      useGlobal: false,
      ignoreUndefined: false,
      useColors: false,
      historySize: ReplConstants.REPL_HISTORY_SIZE,
      // writer: require('util').inspect,
      replMode: repl[ReplConstants.REPL_MODE],
    });

    // console.log(nodeRepl)
    // nodeRepl._domain.on('error', (err) => {
    //   console.log(err);
    // });

    return () => {
      return nodeRepl;
    };
  })();

}
