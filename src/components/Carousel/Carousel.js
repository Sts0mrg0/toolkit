/**
 * @copyright   2010-2016, The Titon Project
 * @license     http://opensource.org/licenses/BSD-3-Clause
 * @link        http://titon.io
 */

import React, { Children, PropTypes } from 'react';
import Component from '../../Component';
import ItemList from './ItemList';
import bind from '../../decorators/bind';
import collectionOf from '../../prop-types/collectionOf';
import generateUID from '../../utility/generateUID';
import emitEvent from '../../utility/emitEvent';
import CONTEXT_TYPES from './contextTypes';
import MODULE from './module';

export default class Carousel extends Component {
  static module = MODULE;

  static childContextTypes = CONTEXT_TYPES;

  static defaultProps = {
    animation: 'slide',
    autoStart: true,
    defaultIndex: 0,
    duration: 5000,
    infinite: true,
    loop: true,
    pauseOnHover: true,
    reverse: false,
    toCycle: 1,
    toShow: 1,
  };

  static propTypes = {
    animation: PropTypes.oneOf(['slide', 'slide-up', 'fade']),
    autoStart: PropTypes.bool,
    children: PropTypes.node,
    defaultIndex: PropTypes.number,
    duration: PropTypes.number,
    infinite: PropTypes.bool,
    loop: PropTypes.bool,
    onCycled: collectionOf.func,
    onCycling: collectionOf.func,
    onStart: collectionOf.func,
    onStop: collectionOf.func,
    pauseOnHover: PropTypes.bool,
    reverse: PropTypes.bool,
    toCycle: PropTypes.number,
    toShow: PropTypes.number,
  };

  state = {
    animating: false,
    index: 0,
    stopped: true,
  };

  uid = generateUID();

  /**
   * Define a context that is passed to all children.
   *
   * @returns {Object}
   */
  getChildContext() {
    const props = this.props;

    return {
      [MODULE.contextKey]: {
        activeIndices: this.getActiveIndices(),
        afterAnimation: this.afterAnimation,
        animation: props.animation,
        currentIndex: this.state.index,
        firstIndex: this.getFirstIndex(),
        infiniteScroll: props.infinite,
        isItemActive: this.isItemActive,
        itemCount: this.countItems(),
        lastIndex: this.getLastIndex(),
        loopedScroll: props.loop,
        nextItem: this.nextItem,
        prevItem: this.prevItem,
        showItem: this.showItem,
        startCycle: this.startCycle,
        stopCycle: this.stopCycle,
        uid: this.uid,
        visibleCount: props.toShow,
      },
    };
  }

  /**
   * Set the default index and bind events before mounting.
   */
  componentWillMount() {
    this.showItem(this.props.defaultIndex);

    window.addEventListener('keydown', this.handleOnKeyDown);
  }

  /**
   * Start the transition animation after rendering,
   * but before children have updated.
   *
   * @param {Object} nextProps
   * @param {Object} nextState
   */
  componentWillUpdate(nextProps, nextState) {
    if (nextState.index !== this.state.index) {
      this.beforeAnimation();
    }
  }

  /**
   * Remove events and timers when unmounting.
   */
  componentWillUnmount() {
    clearTimeout(this.timer);

    window.removeEventListener('keydown', this.handleOnKeyDown);
  }

  /**
   * Functionality to trigger after the cycle animation occurs.
   * We must set the `animating` state to false or we get locked in
   * an unusable state.
   *
   * This *should* be handled by a child component, like `ItemList`.
   */
  @bind
  afterAnimation() {
    this.setState({
      animating: false,
    });

    emitEvent(this, 'onCycled', this.state.index);
  }

  /**
   * Functionality to trigger before the cycle animation occurs.
   *
   * Do not set the `animation` state here as it causes 2 renders
   * and because `componentWillUpdate()` does not allow state changes.
   */
  beforeAnimation() {
    emitEvent(this, 'onCycling', this.state.index);
  }

  /**
   * Counts the number of children found within the `ItemList` child component.
   *
   * @returns {Number}
   */
  countItems() {
    const children = Children.toArray(this.props.children);
    let count = 0;

    // Use a for loop so that we can break out
    for (let i = 0; i < children.length; i += 1) {
      if (children[i].type === ItemList) {
        count = Children.count(children[i].props.children);
        break;
      }
    }

    return count;
  }

  /**
   * Return an array of all item indices that are currently active and visible.
   *
   * @returns {Number[]}
   */
  getActiveIndices() {
    const currentIndex = this.state.index;
    const visibleCount = this.props.toShow;
    const active = [];

    for (let i = 0; i < visibleCount; i += 1) {
      active.push(currentIndex + i);
    }

    return active;
  }

  /**
   * Returns the first index that can be cycled to.
   *
   * @returns {Number}
   */
  getFirstIndex() {
    return 0;
  }

  /**
   * Returns the last index that can be cycled to.
   *
   * @returns {Number}
   */
  getLastIndex() {
    return (this.countItems() - this.props.toShow);
  }

  /**
   * Handles the automatic cycle timer.
   */
  @bind
  handleOnCycle() {
    if (this.state.stopped) {
      return;
    }

    if (this.props.reverse) {
      this.prevItem();
    } else {
      this.nextItem();
    }
  }

  /**
   * Cycle between items based on the arrow key pressed.
   *
   * @param {SyntheticKeyboardEvent} e
   */
  @bind
  handleOnKeyDown(e) {
    switch (e.key) {
      case 'ArrowLeft':
        this.prevItem();
        break;

      case 'ArrowUp':
        this.showItem(this.getFirstIndex());
        break;

      case 'ArrowRight':
        this.nextItem();
        break;

      case 'ArrowDown':
        this.showItem(this.getLastIndex());
        break;

      default:
        return;
    }

    e.preventDefault();
  }

  /**
   * Stop the cycle when entering the carousel.
   */
  @bind
  handleOnMouseEnter() {
    if (this.props.pauseOnHover) {
      this.stopCycle();
    }
  }

  /**
   * Start the cycle when exiting the carousel.
   */
  @bind
  handleOnMouseLeave() {
    if (this.props.pauseOnHover) {
      this.startCycle();
    }
  }

  /**
   * Returns true if the current item is the first index.
   *
   * @returns {Boolean}
   */
  isAtFirst() {
    return (this.state.index === this.getFirstIndex());
  }

  /**
   * Returns true if the current item is the last index.
   *
   * @returns {Boolean}
   */
  isAtLast() {
    return (this.state.index === this.getLastIndex());
  }

  /**
   * Returns true if the item at the specified index is active based
   * on the state index and how many visible items to display.
   *
   * @param {Number} index
   * @returns {Boolean}
   */
  @bind
  isItemActive(index) {
    const currentIndex = this.state.index;

    return (index >= currentIndex && index <= ((currentIndex + this.props.toShow) - 1));
  }

  /**
   * Cycle to the next item.
   */
  @bind
  nextItem() {
    this.showItem(this.state.index + this.props.toCycle);
  }

  /**
   * Cycle to the previous item.
   */
  @bind
  prevItem() {
    this.showItem(this.state.index - this.props.toCycle);
  }

  /**
   * Reset the automatic cycle timer.
   */
  resetCycle() {
    this.stopCycle();
    this.startCycle();
  }

  /**
   * Cycle to the item at the specified index.
   *
   * @param {Number} index
   */
  @bind
  showItem(index) {
    // eslint-disable-next-line no-lonely-if
    if (this.state.animating) {
      return;
    }

    const props = this.props;
    const currentIndex = this.state.index;
    const lastIndex = this.getLastIndex();
    const firstIndex = this.getFirstIndex();
    const itemCount = this.countItems();

    if (props.infinite) {
      if (index >= itemCount) {
        index = firstIndex + (index - itemCount);
      } else if (index < firstIndex) {
        index = itemCount + index;
      }
    } else {
      if (index > lastIndex) {
        index = props.loop ? firstIndex + (index - lastIndex - 1) : lastIndex;
      } else if (index < firstIndex) {
        index = props.loop ? lastIndex + index + 1 : firstIndex;
      }
    }

    // Stop the cycle if on the last item
    if (!props.loop && index === lastIndex) {
      this.stopCycle();

    // Reset the cycle timer
    } else if (props.autoStart) {
      this.startCycle();
    }

    // Break out early if the same index
    if (currentIndex === index) {
      return;
    }

    this.setState({
      animating: true,
      index,
    });
  }

  /**
   * Start the automatic cycle timer.
   */
  @bind
  startCycle() {
    clearTimeout(this.timer);

    this.timer = setTimeout(this.handleOnCycle, this.props.duration);

    this.setState({
      stopped: false,
    });

    emitEvent(this, 'onStart');
  }

  /**
   * Stop the automatic cycle timer.
   */
  @bind
  stopCycle() {
    clearTimeout(this.timer);

    this.setState({
      stopped: true,
    });

    emitEvent(this, 'onStop');
  }

  /**
   * Render the wrapping carousel element.
   *
   * @returns {ReactElement}
   */
  render() {
    const { children, animation, loop, autoStart } = this.props;
    const { animating, stopped } = this.state;

    return (
      <div
        role="tablist"
        id={this.formatID('carousel')}
        className={this.formatClass({
          [animation]: true,
          'is-animating': animating,
          'is-stopped': stopped,
          'no-next': (!loop && this.isAtLast()),
          'no-prev': (!loop && this.isAtFirst()),
        })}
        aria-live={autoStart ? 'assertive' : 'off'}
        onMouseEnter={this.handleOnMouseEnter}
        onMouseLeave={this.handleOnMouseLeave}
      >
        {children}
      </div>
    );
  }
}