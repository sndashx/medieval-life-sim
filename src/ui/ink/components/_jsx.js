// Shared HTM+React binding. Import `html` from here in every component
// instead of repeating `htm.bind(React.createElement)`.

import React from 'react';
import htm from 'htm';
import { Box, Text, useInput, useApp, useFocus, useFocusManager } from 'ink';

export const html = htm.bind(React.createElement);
export { React, Box, Text, useInput, useApp, useFocus, useFocusManager };
export const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;