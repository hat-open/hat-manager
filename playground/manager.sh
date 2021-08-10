#!/bin/sh

. $(dirname -- "$0")/env.sh

CONF_PATH=$DATA_PATH/manager.yaml

exec $PYTHON -m hat.manager \
    --conf $CONF_PATH \
    "$@"
