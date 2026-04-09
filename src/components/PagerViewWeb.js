// PagerViewWeb.js  – Web shim for react-native-pager-view
// On web the native PagerView module is not available, so we simulate it
// with a simple ScrollView / pointer-driven swipeable view.
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, ScrollView } from 'react-native';

const PagerViewWeb = forwardRef(function PagerViewWeb(
  { children, initialPage = 0, onPageSelected, style, ...rest },
  ref
) {
  const scrollRef = useRef(null);
  const [page, setPage] = useState(initialPage);
  const pages = React.Children.toArray(children);
  const [width, setWidth] = useState(0);

  useImperativeHandle(ref, () => ({
    setPage(index) {
      if (scrollRef.current && width > 0) {
        scrollRef.current.scrollTo({ x: index * width, animated: true });
      }
      setPage(index);
      onPageSelected?.({ nativeEvent: { position: index } });
    },
  }));

  const handleScroll = (e) => {
    if (width <= 0) return;
    const newPage = Math.round(e.nativeEvent.contentOffset.x / width);
    if (newPage !== page) {
      setPage(newPage);
      onPageSelected?.({ nativeEvent: { position: newPage } });
    }
  };

  return (
    <View
      style={[{ flex: 1 }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        contentOffset={{ x: initialPage * width, y: 0 }}
        style={{ flex: 1 }}
        scrollEventThrottle={16}
      >
        {pages.map((child, i) => (
          <View key={i} style={{ width, flex: 1 }}>
            {child}
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

export default PagerViewWeb;
