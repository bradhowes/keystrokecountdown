class LowPassFilter(object):

    '''
    A finite-impulse response (FIR) low-pass filter. The filter coefficients are from
    http://t-filter.appspot.com, and they correspond to the following design parameters:

    * Sampling frequency: 2048 Hz

    * Pass band: 0 Hz - 512 Hz
    ** Gain = 1
    ** Desired ripple = 1 dB
    ** Actual ripple = 0.37 dB

    * Block band: 512 Hz - 1024 Hz
    ** Gain = 0
    ** Desired attenuation = -40 dB
    ** Actual attenuation = -46.15 dB

    '''
    taps = [ 
        0.004902976537587121,
        -0.003848680346403288,
        -0.01344100739497891,
        0.000365702301723367,
        0.012456560428623616,
        -0.009746219260722114,
        -0.01662548164089962,
        0.020488459862084474,
        0.015961872380948205,
        -0.03791921428939781,
        -0.008557759377898273,
        0.0644394686133685,
        -0.015038216682644084,
        -0.1162658438508493,
        0.10505867020106813,
        0.4871082473199869,
        0.4871082473199869,
        0.10505867020106813,
        -0.1162658438508493,
        -0.015038216682644084,
        0.0644394686133685,
        -0.008557759377898273,
        -0.03791921428939781,
        0.015961872380948205,
        0.020488459862084474,
        -0.01662548164089962,
        -0.009746219260722114,
        0.012456560428623616,
        0.000365702301723367,
        -0.01344100739497891,
        -0.003848680346403288,
        0.004902976537587121,]

    tapCount = len(taps)
    tapMask = tapCount - 1

    def __init__(self):
        '''
        Initialize instance.
        '''
        self.reset()

    def reset(self):
        '''
        Reset the filter, forgetting all past sample history.
        '''
        self.history = [0] * self.tapCount
        self.lastIndex = 0

    def __call__(self, value):
        '''
        Add a sample to the filter and obtain the filter's response.

        @param value the sample to add
        @return filtered value
        '''

        # Add the value to the ring buffer
        #
        index = self.lastIndex
        self.history[index] = value
        index = (index + 1) & self.tapMask
        self.lastIndex = index

        # Calculate the new filter value and return it
        #
        value = value * self.taps[0]
        for tapIndex in range(1, len(self.taps)):
            index = (index - 1) & self.tapMask
            value += self.history[index] * self.taps[tapIndex]

        return value
