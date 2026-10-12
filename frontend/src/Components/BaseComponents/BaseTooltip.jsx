import Tooltip from '@mui/material/Tooltip';
import PropTypes from 'prop-types';

const BaseTooltip = ({ title, children, placement = 'right', wrap = false, enterDelay = 500, leaveDelay = 100, open: openProp, ...props }) => {
    if (!title) {
        return children;
    }

    // `fit-content` ajusta el wrapper al ancho preferido del hijo, pero por sí solo
    // no lo limita al del contenedor: sin `maxWidth`, un campo ancho desborda y el
    // `maxWidth: 100%` del propio campo resuelve contra el wrapper, no contra el padre.
    const content = wrap ? <div style={{ width: 'fit-content', maxWidth: '100%' }}>{children}</div> : children;
    const controlled = openProp !== undefined;

    return (
        <Tooltip
            title={title}
            arrow
            placement={placement}
            enterDelay={enterDelay}
            leaveDelay={leaveDelay}
            disableFocusListener
            {...(controlled && {
                open: openProp,
                disableHoverListener: true,
                disableTouchListener: true,
            })}
            {...props}
        >
            {content}
        </Tooltip>
    );
};

BaseTooltip.propTypes = {
    title: PropTypes.node,
    children: PropTypes.node.isRequired,
    placement: PropTypes.string,
    wrap: PropTypes.bool,
    enterDelay: PropTypes.number,
    leaveDelay: PropTypes.number,
    open: PropTypes.bool,
};

export default BaseTooltip;
